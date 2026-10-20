# Descuento de inventario: diseño idempotente

> Cómo el sistema descuenta el stock al completar una comanda, y por qué eso
> nunca descuenta dos veces.

---

## 1. El problema

Cuando una comanda se marca como servida, el sistema descuenta del inventario
los ingredientes de los productos pedidos. Antes de este trabajo, ese
descuento se ejecutaba de forma libre:

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
| `stockDescontado` | El inventario **ya fue descontado** por esta comanda. |
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
                             └── descuento OK ──► stock=true
                                          └── fallo ──► stock=false
                                                          (reintentable)
```

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

## 5. Reversión al borrar una comanda

Si una comanda ya descontó stock y luego se borra, el stock **vuelve al
inventario**. La devolución y el borrado ocurren en la **misma transacción**
(MongoDB no permite anidar transacciones), así que no puede quedar stock
devuelto sin comanda borrada, ni comanda borrada sin devolver el stock.

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

Suite de 23 pruebas end-to-end en `scripts/verificar-inventario.js`:

| Caso | Resultado esperado |
|---|---|
| Completar una comanda | El stock baja exactamente lo que dice la receta |
| Completar **5 veces** la misma comanda | El stock baja **una sola vez** |
| **8 PATCH simultáneos** a la misma comanda | El stock baja **una sola vez** |
| Dos productos con el mismo ingrediente | Se resta la **suma**, en una operación |
| Borrar una comanda completada | El stock **vuelve** a su valor anterior |
| Renombrar el Producto después de pedirlo | El descuento **se sigue aplicando** (por id) |
| Plato enviado sin opciones | No descuenta y deja **aviso** |
| Producto con ingrediente borrado | La comanda se completa y deja **aviso** |
| Stock insuficiente | Queda en **negativo** y deja **aviso** |
| Dos comandas distintas | Se descuenta **una vez cada una** |
| La comanda guardada | `stockDescontado = true` con su fecha |

```bash
# Con el backend corriendo en otra terminal:
cd Backend
npm run verificar:inventario
```

La suite crea su propia empresa de prueba y la elimina al final, así que no
tocan los datos reales.

> La suite permanente de pruebas unitarias (`node --test`) está pendiente:
> el comando `npm test` ya está configurado, pero la carpeta `test/` todavía
> no existe.

---

## 8. Limitaciones conocidas y decisiones pendientes

1. **Un plato enviado sin opciones no descuenta nada.** No hay forma de saber
   qué se preparó. Se avisa, pero la regla de negocio concreta ("si el cliente
   no elige nada, se descuenta el producto principal") **no está definida** y
   requiere un campo que distinga el producto principal de los acompañamientos.

2. **El descuento ocurre al marcar "servida", no al enviar el pedido.** Es lo
   que pidió el enunciado (descuento de stock al completarse la comanda), pero
   en un restaurante real el stock se reserva al **enviar** el pedido: entre
   el envío y el servicio, otra mesa puede pedir lo mismo que ya no hay.

3. **No hay reserva de stock.** `disponible` en el ingrediente es un booleano
   manual que nadie actualiza automáticamente a partir del descuento.

4. **El precio no se recalcula desde el catálogo.** La comanda guarda el
   precio del platillo tal como se envió; si el administrador cambia el
   precio después, el recibo y los reportes usan el precio histórico. Es lo
   correcto para un cierre contable, pero conviene documentarlo.
