# Comandas — Sistema de toma de pedidos para restaurantes

Sistema web multi-empresa para tomar el pedido del cliente y comunicarlo a la
cocina, reemplazando las comandas escritas a mano.

**Problema que resuelve:** el personal de sala dependía de recordar el menú del
día y transcribir el pedido a papel, con el riesgo de errores de lectura y de
pedidos perdidos.

---

## 1. Arquitectura

```
Comandas/
├── Backend/          API REST + MongoDB (Node + Express + Mongoose)
│   ├── config/       carga y validacion de variables de entorno
│   ├── controllers/  logica de negocio
│   ├── middlewares/  autenticacion, roles, empresa activa, rate limit
│   ├── models/       esquemas Mongoose
│   ├── routes/       definicion de endpoints
│   ├── scripts/      migraciones de datos
│   ├── test/         pruebas automatizadas (node --test)
│   └── utils/        helpers de alcance (multi-empresa) y de campos
└── Frontend/         SPA (React 19 + Vite + Tailwind)
    └── src/
        ├── components/   componentes de interfaz
        ├── context/      contexto de autenticacion
        ├── hooks/        logica de negocio del cliente
        ├── pages/        vistas
        └── utils/        calculos de impuestos, recibos TXT y PDF
```

Los dos proyectos son **repositorios git independientes**:
`comandas.prueba.git` (Backend) y `Comandas-Front.git` (Frontend).

---

## 2. Requisitos

- **Node.js >= 20.19** (el backend usa `require(esm)` en versiones recientes y
  el runner de pruebas nativo).
- **MongoDB** (Atlas o local). Las transacciones requieren un replica set;
  Atlas lo es.
- npm 10+.

---

## 3. Puesta en marcha

### 3.1 Backend

```bash
cd Backend
npm install
cp .env.example .env      # y completar los valores
npm run dev               # http://localhost:3001
```

Variables de entorno (ver `Backend/.env.example`):

| Variable | Obligatoria | Descripcion |
|---|---|---|
| `PORT` | no | Puerto del servidor (3001 por defecto) |
| `MONGO_URI` | **si** | Cadena de conexion a MongoDB |
| `JWT_SECRET` | **si en produccion** | Secreto de firma de los JWT. El servidor **no arranca** si falta en produccion |
| `CLIENT_ORIGIN` | no | Origenes permitidos por CORS, separados por coma |
| `NODE_ENV` | no | `development` (por defecto) o `production` |

### 3.2 Frontend

```bash
cd Frontend
npm install
cp .env.example .env      # y ajustar VITE_API_URL
npm run dev               # http://localhost:5173
```

| Comando | Que hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion en `dist/` |
| `npm run lint` | ESLint (debe salir en 0 problemas) |
| `npm run preview` | Sirve el build de produccion |

### 3.3 Crear el primer restaurante

El alta de una empresa es **publica pero atomica**: crea la empresa y su primer
administrador en una sola transaccion, con la contrasena ya hasheada.

```bash
curl -X POST http://localhost:3001/api/empresa/registro \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Restaurante Demo",
    "nit": "900123456",
    "razonSocial": "Restaurante Demo S.A.S.",
    "nombreAdmin": "Ana",
    "apellidoAdmin": "Restaurante",
    "correoAdmin": "ana@demo.com",
    "contraseñaAdmin": "secreta123",
    "usaIva": false
  }'
```

La respuesta incluye el `token` del administrador: ya queda con sesión
iniciada. También hay una interfaz en `Frontend/crear_empresa.html`.

---

## 4. Roles

| Rol | Que puede hacer |
|---|---|
| **Admin** | Todo lo de su empresa: menú, productos, inventario, usuarios, comandas, reportes y datos de la empresa. |
| **Mesero** | Toma el pedido, lo envia a cocina, ve las comandas de su empresa y marca las servidas. No toca menú, productos, inventario ni usuarios. |
| **Cocina** | Ve las comandas entrantes (sin precios) y cambia su estado. No ve reportes ni datos de la empresa. |

El modelo es multi-empresa: todas las empresas comparten base de datos y el
aislamiento se aplica **en la capa de consulta**, no en la interfaz.

---

## 5. Documentación técnica

| Documento | Que cubre |
|---|---|
| [`Backend/MATRIZ-ACCESO.md`](Backend/MATRIZ-ACCESO.md) | Matriz endpoint × rol, reglas para agregar rutas, aislamiento entre empresas y lista de verificación. |
| [`Backend/DOCUMENTO-DESCUENTO-INVENTARIO.md`](Backend/DOCUMENTO-DESCUENTO-INVENTARIO.md) | Cómo se descuenta el stock, por qué es idempotente y cómo se recupera de un fallo. |

---

## 6. Pruebas

```bash
cd Backend
npm test
```

51 pruebas automatizadas sobre tres archivos:

| Archivo | Qué verifica |
|---|---|
| `test/seguridad.test.js` | Rutas que antes eran públicas, roles, control de datos de la empresa y login. |
| `test/idor.test.js` | Aislamiento entre empresas, mass assignment y permisos por rol. |
| `test/inventario.test.js` | Idempotencia del descuento, acumulación, reversión y avisos. |

Las pruebas levantan la API en un puerto libre dentro del propio proceso (no
hace falta levantar el servidor aparte) y crean sus propias empresas de
prueba, que eliminan al terminar.

> La suite corre contra la base de datos configurada en `.env`. Para no tocar
> datos reales, se recomienda apuntar `MONGO_URI` a una base de pruebas.

---

## 7. Despliegue

### Backend (Render)

- Root directory: `Backend`
- Build command: `npm install`
- Start command: `npm start`

Variables de entorno **obligatorias** en el panel de Render:

```
NODE_ENV=production
MONGO_URI=...
JWT_SECRET=<valor aleatorio de 48 bytes>
CLIENT_ORIGIN=https://<tu-frontend>.vercel.app
```

Generar un secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Cambiar el `JWT_SECRET` invalida todas las sesiones abiertas: el usuario
> tiene que volver a iniciar sesión. Es lo esperado.

### Frontend (Vercel)

- Root directory: `Frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Variable de entorno: `VITE_API_URL=https://<tu-backend>.onrender.com`

---

## 8. Migraciones de datos

Scripts idempotentes que se ejecutan una sola vez tras un cambio de esquema:

```bash
npm run migrate:roles      # Vendedor -> Mesero
npm run migrate:impuestos  # Empresas a INC 8% (usaIva = false)
```

---

## 9. Limitaciones conocidas

Están documentadas en detalle en los documentos técnicos. Las principales:

1. **No hay vista de cocina.** El rol `Cocina` existe y tiene sus permisos
   (ve las comandas sin precios y puede marcarlas como servidas), pero la
   pantalla `/cocina` todavía no existe: la cocina usa la vista de mesero.
2. **La sincronización es por sondeo, no en tiempo real.** Las comandas se
   refrescan cada 4 segundos. `socket.io` ya está instalado en el backend pero
   todavía no se usa.
3. **Las mesas viven en el estado del navegador.** No hay modelo de mesa en la
   base de datos: si se recarga la página, se pierde el pedido en curso.
4. **Un plato enviado sin opciones no descuenta stock.** Se avisa, pero falta
   definir la regla de negocio ("si el cliente no elige, se descuenta el
   producto principal").
5. **No hay reserva de stock.** El descuento ocurre al marcar la comanda como
   servida, no al enviarla.
6. **El precio se guarda en la comanda** tal como se envió, para que los
   recibos históricos no cambien si el menú se actualiza.
