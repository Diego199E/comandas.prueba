# Descuento de inventario: diseño idempotente

> Cómo el sistema descuenta el stock al **enviar** un pedido, y por qué eso
> nunca descuenta dos veces.

---

## 1. El problema

Cuando un pedido entra a cocina, el stock de sus ingredientes deja de estar
disponible **en ese momento**, no cuando se sirve. Antes el descuento
ocurría al marcar la comanda como "servida", y entre una cosa y la otra
pasabaneas minutos: otra mesa podía pedir lo mismo que ya no había, y el
sistema no se enteraba hasta que la primera comanda se completaba.

Además, el descuento se ejecutaba de forma libre:

```js
comanda.estado = true;
await comanda.save();
await descontarIngredientesComanda(comanda._id);   // <- se podía repetir
```

Cualquier segunda llamada a "completar" volvía a descontar. Y completar una
comanda es una operación que **ocurre muchas veces por el mismo botón**:

| Disparador | Probabilidad |
|---|---|
| Doble clic del mesero | Alta |
| Reintento por timeout de red | Media |
| Polling de la vista de comandas + clic manual | Media |
| Dos pestañas abiertas con la misma comanda | Media |
| Un proxy que reintenta la petición | Baja |

Un doble clic descontaba **dos veces** el stock: el inventario del
restaurante se vaciaba solo, sin que nadie hubiera consumido el producto.

---

## 2. Los dos estados de una comanda

Una comanda tiene **dos marcas independientes**:

| Campo | Significado |
|---|---|
| `estado` | La comanda fue marcada como servida (lo que ve el personal). |
| `stockDescontado` | El inventario **ya fue descontado** (reservado) por esta comanda. |
| `stockDescontadoEn` | Cuándo se hizo el descuento. |
| `alertasStock` | Avisos del proceso (stock negativo, productos sin resolver…). |

Separarlas es lo que permite que la comanda se marque como servida aunque el
descuento de stock falle: la comida ya se preparó, el pedido **no puede
quedarse bloqueado** por un problema de inventario. Si el descuento falla, la
comanda queda `estado: true` y `stockDescontado: false`, y un reintento lo
recupera.

```
        crear                completar                  borrar
  estado=false  ───────►  estado=true  ───────────►  (se borra)
  stock=false             stock=false                stock=false
                             │
                             └── reserva OK ──► stock=true
                                          └── fallo ──► stock=false
                                                          (reintentable)
```

El movimiento del stock ocurre al **crear** la comanda (reserva), no al
completarla. Marcar como servida ya no mueve el inventario: solo cambia el
estado.

---

## 3. El mecanismo de garantía

### 3.1 Reclamación atómica

Dentro de la transacción se hace un `updateOne` **condicional**:

```js
const claim = await Comanda.updateOne(
  { _id: comandaId, stockDescontado: { $ne: true } },
  { $set: { stockDescontado: true, stockDescontadoEn: new Date() } },
  { session }
);

if (claim.modifiedCount === 0) {
  // Otra petición ya lo descontó: esta no toca nada.
}
```

Un `updateOne` de un solo documento es atómico en MongoDB, así que de N
peticiones simultáneas **exactamente una** logra reclamarlo.

> **Por qué `{$ne: true}` y no `{stockDescontado: false}`?**
> En MongoDB, `{campo: false}` **no** matchea un documento al que le falta el
> campo. Las comandas creadas antes de que existiera este campo no lo tienen,
> así que con `{stockDescontado: false}` el descuento **nunca se aplicaría** a
> ellas. `$ne: true` matchea tanto `false` como la ausencia del campo.

### 3.2 Todo o nada

El descuento completo ocurre **dentro de una transacción** de MongoDB:

1. Reclamar (`stockDescontado` → `true`)
2. Calcular el movimiento de inventario
3. Aplicarlo (`bulkWrite` con `$inc`)
4. Guardar los avisos

Si algo falla en el paso 2 o 3, la transacción hace **rollback**: el stock no
se toca y `stockDescontado` vuelve a `false`. No queda un estado intermedio
"descontado a medias".

### 3.3 Idempotencia de la transición de estado

Marcar la comanda como servida también es idempotente, y se hace con una
actualización atómica en lugar de leer-y-escribir:

```js
const comanda = await Comanda.findOneAndUpdate(
  filtroEmpresa(req, { _id: id, estado: { $ne: true } }),
  { $set: { estado: true } },
  { new: true }
);

// Si no hubo transición, la comanda ya estaba completada.
```

---

## 4. Cómo se resuelve qué descontar

### 4.1 Por identificador, no por nombre (nuevo)

El campo `platillos[].productos` guarda los **nombres** de los productos
elegidos por el cliente (son los que van en el recibo). Con esos nombres no se
puede descontar de forma fiable: si el administrador renombra un producto, el
descuento deja de encontrarlo **y no pasa nada visible**.

Por eso, al crear o editar la comanda se resuelve cada nombre a su
`Producto` real y se guarda el par:

```js
productosResueltos: [
  { nombre: 'Hamburguesa', producto: ObjectId('...') }
]
```

A partir de ahí el descuento usa **ids**, y un renombrado ya no rompe nada.
Las comandas antiguas (sin este campo) se resuelven por nombre como plan B.

### 4.2 Acumulación antes de aplicar

Si tres productos usan el mismo ingrediente, se **suman** las cantidades y se
aplica **una sola** operación. Esto además de ser correcto evita que se
pierdan actualizaciones: antes se hacía

```js
ingrediente.cantidad -= cantidad;   // lectura-modificación-escritura
await ingrediente.save();           // <- propenso a lost update
```

y ahora se usa

```js
await Ingrediente.bulkWrite([
  { updateOne: { filter: { _id: id }, update: { $inc: { cantidad: -15 } } } }
], { session });
```

`$inc` es atómico y acumulativo: dos comandas simultáneas sobre el mismo
ingrediente no se pisan.

### 4.3 Sin consultas N+1

Antes se hacía **una consulta de producto y un `save()` por cada uso** de
ingrediente. Ahora son **dos consultas en total** (productos + ingredientes) y
**un `bulkWrite`** para aplicar todo.

---

## 4. Qué se descuenta: la composición del plato

### La regla

El `contenido` de un plato **es** su composición: para "Combo Hamburguesa"
puede ser `Principio: Hamburguesa`, `Acompañamiento: Papas a la francesa`,
`Bebida: Gaseosa`. El pedido se descuenta sobre **lo que el cliente pidió**.

Cuando el mesero no elige ninguna opción, el plato se prepara **como está
diseñado**: se descuentan todos sus componentes. Sin esta regla, el pedido se
enviaba sin descontar nada y solo quedaba un aviso.

### Dónde se aplica

La regla vive en **dos capas**, y la del backend es la autoritativa:

| Capa | Qué hace |
|---|---|
| **Frontend** (`useMesero`) | El modal de opciones abre con **todo seleccionado** (el plato tal como está diseñado) y el mesero **deselecciona** lo que el cliente no quiera. Las opciones fijas (`seleccionable: false`) no son botones: se muestran como "Incluye: ..." y siempre se preparian. |
| **Backend** (`aplicarComposicionPorDefecto`) | Si un platillo llega sin productos, se busca el plato en el catálogo y se le aplica su `contenido` completo. El backend **no confía** en lo que le manden: un cliente de la API que envíe `productos: []` recibe la misma composición por defecto. |

Si el plato **no tiene composición registrada** en el catálogo, entonces no se
puede saber qué se preparó: no se descuenta nada y se deja el aviso
("se envió sin productos seleccionados").

### Cómo queda registrado

La comanda guarda `productoPorDefecto: true` cuando la composición se asumió,
para que el recibo refleje que **se asumió**, no que el cliente lo pidió así.

### Verificado

Con un combo de tres componentes (uno fijo) y 12 kg de harina:

```
El mesero abre el modal  ->  Hamburguesa [seleccionada], Gaseosa [seleccionada],
                             "Incluye: Papas a la francesa"
Deselecciona Gaseosa   ->  se prepara: Hamburguesa + Papas
Se envía el pedido     ->  Harina 100 -> 90   (Hamburguesa: 10)
                             Queso   50 -> 47   (Papas: 3)
                             la Gaseosa NO se descontó
```

---

## 5. Reserva de stock: qué ve el mesero

El descuento ocurre al **crear** la comanda, así que la respuesta del `POST`
incluye el resultado de la reserva y el frontend muestra los avisos **en el
momento en que se envía el pedido**, que es cuando el mesero todavía puede
hacer algo al respecto.

Verificado con dos mesas pidiendo la última porción de un producto:

```
Mesa 1 envía "Desayuno"  ->  "✅ Comanda enviada con éxito"
   Harina: 12 kg -> 2 kg

Mesa 2 envía "Desayuno"  ->  "⚠️ Avisos de inventario:
                                "Harina" quedó en negativo (2 - 10 = -8 kg)"
```

Antes ese overselling se descubría 20 minutos después, cuando la primera
comanda se marcaba como servida.

### Cancelar un pedido devuelve el stock

Si el pedido se borra (el cliente cambió de opinión, la cocina se equivocó),
el stock reservado **vuelve al inventario**, en la misma transacción que el
borrado:

```js
await session.withTransaction(async () => {
  const comanda = await Comanda.findOne(filtroEmpresa(req, { _id: id })).session(session);
  if (!comanda) return;

  if (comanda.stockDescontado) {
    stock = await revertirEnSession(session, id);   // +15 al inventario
  }

  comandaEliminada = await Comanda.findOneAndDelete(filtroEmpresa(req, { _id: id })).session(session);
});
```

Por eso, con la reserva activa, el ciclo completo queda cuadrado:

| Momento | Stock |
|---|---|
| Se envía el pedido | −10 (reserva) |
| Se marca como servida | 0 (no vuelve a descontar) |
| Se borra la comanda | +10 (vuelve) |

---

## 6. Avisos (`alertasStock`)

El proceso ya no se pierde en un `console.log`. Los avisos se guardan en la
comanda y se devuelven en la respuesta del PATCH, y la interfaz los muestra al
mesero:

| Situación | Aviso |
|---|---|
| Stock insuficiente | `"Azucar" quedó en negativo (1 - 2 = -1 kg)` |
| Plato enviado sin opciones | `El plato "Desayuno" se envió sin productos seleccionados: no se descontó stock` |
| Producto sin receta | `El producto "Pan" no tiene receta: no se descontó stock` |
| Ingrediente borrado | `El producto "Pan" referencia un ingrediente que ya no existe: se omitió` |
| Opción inexistente en el catálogo | `En el plato "Desayuno" hay 1 opción(es) que no existen en el catálogo` |

El stock **negativo se permite a propósito**: la comida ya se preparó, negar
el descuento solo genera más inconsistencias. Lo que se hace es avisar.

---

## 7. Verificación

Suite de pruebas automatizadas en `test/inventario.test.js` (runner nativo de
Node, `node --test`):

| Caso | Resultado esperado |
|---|---|
| **Crear** una comanda | El stock baja inmediatamente (reserva) |
| Marcar la comanda como servida | El stock **no** baja otra vez |
| Completar **5 veces** la misma comanda | El stock baja **una sola vez** |
| **8 PATCH simultáneos** a la misma comanda | El stock baja **una sola vez** |
| Dos productos con el mismo ingrediente | Se resta la **suma**, en una operación |
| **Borrar** una comanda pendiente (reservada) | El stock **vuelve** |
| **Borrar** una comanda ya servida | El stock **vuelve** |
| Borrar dos veces la misma comanda | El stock vuelve **una sola vez** |
| Renombrar el Producto después de pedirlo | El descuento **se sigue aplicando** (por id) |
| Plato enviado sin opciones | No descuenta y deja **aviso** |
| Producto con ingrediente borrado | La comanda se crea y deja **aviso** |
| Stock insuficiente | Queda en **negativo** y deja **aviso** |
| Dos comandas distintas | Se descuenta **una vez cada una** |
| La comanda guardada | `stockDescontado = true` con su fecha |

```bash
cd Backend
npm test
```

Las pruebas levantan la API en un puerto libre dentro del propio proceso, no
necesitan el servidor corriendo en otra terminal. Cada prueba crea su propia
empresa de prueba y la elimina al final, así que no tocan los datos reales.

---

## 8. Limitaciones conocidas y decisiones pendientes

1. **Un plato enviado sin opciones no descuenta nada.** No hay forma de saber
   qué se preparó. Se avisa, pero la regla de negocio concreta ("si el cliente
   no elige nada, se descuenta el producto principal") **no está definida** y
   requiere un campo que distinga el producto principal de los acompañamientos.

2. **El stock se descuenta al enviar el pedido**, no al servirlo. Es lo que
   corresponde a una reserva: desde que el pedido entra a cocina, ese stock
   ya no está disponible para otra mesa. Como contrapartida, **el inventario
   muestra menos de lo que hay físicamente** (no hay una columna de
   "reservado" separada). Un modelo con `cantidad` y `reservado` por separado
   daría un desglose más fino, a costa de más lógica en todas partes.

3. **No se bloquea el pedido por falta de stock.** Si no alcanza, la comanda se
   crea igual, el stock queda en negativo y se avisa. En un restaurante con
   datos de inventario imperfectos, bloquear pedidos es peor que avisar.

4. **Un plato enviado sin opciones ya no es un caso raro.** Con la
   composición por defecto, solo queda sin descontar cuando el plato **no
   tiene `contenido` registrado** en el catálogo. Sigue faltando una forma de
   distinguir el "producto principal" cuando un combo tiene varios
   componentes y el cliente quiere solo uno: hoy eso se resuelve
   deseleccionando en el modal, no con un campo propio.

5. **El precio no se recalcula desde el catálogo.** La comanda guarda el
   precio del platillo tal como se envió; si el administrador cambia el
   precio después, el recibo y los reportes usan el precio histórico. Es lo
   correcto para un cierre contable, pero conviene documentarlo.
