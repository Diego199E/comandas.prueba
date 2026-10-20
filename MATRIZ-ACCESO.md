# Matriz de acceso y control de autorización

> Documento de referencia del backend. Define **quién puede hacer qué** en cada
> endpoint. Toda ruta nueva debe agregarse a esta matriz antes de salir a
> producción.

---

## 1. Roles

Definidos en `Backend/models/usuario.model.js` (`enum`).

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| **Admin** | Dueño / gerente del restaurante | Todo lo de su empresa: menú, productos, inventario, usuarios, comandas, reportes y datos de la empresa. |
| **Mesero** | Personal de sala | Toma el pedido, lo envía a cocina, ve las comandas de su empresa y marca las que servidas. **No** toca menú, productos, inventario ni usuarios. |
| **Cocina** | Personal de cocina | Ve las comandas entrantes y cambia su estado. **No** ve precios, reportes ni datos de la empresa. |

> El rol antiguo `Vendedor` era un residuo de una plantilla de POS y no aplica a
> un restaurante. Se migró a `Mesero` con `npm run migrate:roles`.

---

## 2. Alcance (multi-empresa)

Todas las empresas comparten la misma base de datos. El aislamiento se
implementa en **la capa de consulta**, no en la interfaz:

> **Regla de oro:** toda lectura o escritura sobre datos de negocio filtra por
> la empresa del usuario autenticado.

El identificador sale siempre de `req.empresaId`, que inyecta
`middlewares/auth.middleware.js`. Los helpers están en `utils/scope.js`:

```js
const { empresaIdDe, filtroEmpresa } = require('../utils/scope');

await Comanda.find(filtroEmpresa(req));                       // solo mi empresa
await Comanda.findOneAndUpdate(
  filtroEmpresa(req, { _id: id }),                            // solo mi empresa
  datos, { new: true }
);
```

Corregir una fuga de este tipo **siempre** significa lo mismo: añadir el filtro
por empresa a la consulta. No hay excepciones.

---

## 3. Matriz de endpoints

`✔` = permitido · `—` = prohibido (403) · `P` = público (sin token)

| Método | Ruta | Admin | Mesero | Cocina | Público | Middlewares |
|---|---|:--:|:--:|:--:|:--:|---|
| POST | `/api/auth/login` | ✔ | ✔ | ✔ | **P** | — |
| POST | `/api/auth/register` | ✔ | — | — | — | `token`, `Admin` |
| GET | `/api/auth/perfil` | ✔ | ✔ | ✔ | — | `token` |
| POST | `/api/empresa/registro` | — | — | — | **P** | — |
| GET | `/api/empresa/mi` | ✔ | ✔ | ✔ | — | `token` |
| PUT | `/api/empresa/mi` | ✔ | — | — | — | `token`, `Admin` |
| DELETE | `/api/empresa/mi` | ✔ | — | — | — | `token`, `Admin`, contraseña |
| GET | `/api/usuarios` | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |
| PUT | `/api/usuarios/:id` | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |
| DELETE | `/api/usuarios/:id` | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |
| GET | `/api/platos` | ✔ | ✔ | ✔ | — | `token`, `empresaActiva` |
| POST | `/api/platos` | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |
| PUT | `/api/platos/:id` | ✔ | — | — | — | `token`, `Admin` |
| DELETE | `/api/platos/:id` | ✔ | — | — | — | `token`, `Admin` |
| GET | `/api/productos` | ✔ | ✔ | — | — | `token`, `empresaActiva` |
| POST/PUT/DELETE | `/api/productos[/:id]` | ✔ | — | — | — | `token`, `empresaActiva` |
| GET | `/api/ingredientes` | ✔ | ✔ | — | — | `token`, `empresaActiva` |
| POST/PUT/DELETE | `/api/ingredientes[/:id]` | ✔ | — | — | — | `token`, `empresaActiva` |
| GET | `/api/menues` | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |
| POST/PUT/DELETE | `/api/menues[/:id]` | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |
| GET | `/api/menues/public/:slug` | ✔ | ✔ | ✔ | **P** | — |
| GET | `/api/comandas` | ✔ | ✔ | ✔ | — | `token`, `empresaActiva` |
| POST | `/api/comandas` | ✔ | ✔ | — | — | `token`, `empresaActiva` |
| PUT | `/api/comandas/:id` | ✔ | ✔ | — | — | `token`, `empresaActiva` |
| PATCH | `/api/comandas/:id` | ✔ | ✔ | ✔ | — | `token`, `empresaActiva` |
| DELETE | `/api/comandas/:id` | ✔ | — | — | — | `token`, `empresaActiva` |
| DELETE | `/api/comandas` (todas) | ✔ | — | — | — | `token`, `empresaActiva`, `Admin` |

### Notas de la matriz

- **No existe super-administrador de plataforma.** Cada `Admin` administra
  únicamente su empresa. Por eso no hay ruta para listar, editar o borrar
  empresas ajenas, y `GET /api/empresa` (listar todas) fue retirado.
- `activa` y `pagoRealizado` **no son editables** por el Admin de la empresa:
  si lo fueran, un restaurante podría auto-habilitarse. Se cambian por
  script/administración de base de datos.
- `DELETE /api/empresa/mi` y `DELETE /api/usuarios/:id` exigen **confirmar la
  contraseña del administrador** por ser operaciones irreversibles.
- El `PATCH /api/comandas/:id` es la única ruta por la que `Cocina` actúa, y
  solo sobre el **estado** de la comanda.

---

## 4. Reglas para agregar una ruta nueva

1. **Autenticación:** toda ruta que toque datos de negocio lleva
   `verificarToken`. Si es pública, debe justificarse en esta matriz.
2. **Rol:** usar `permitirRoles('Admin')` para escrituras.
   La lectura puede ser amplia.
3. **Alcance:** filtrar por `empresa` usando `utils/scope.js`.
   Una ruta que escriba sin filtro por empresa es un **bloqueante**.
4. **Nunca** usar `req.body` directo en `findByIdAndUpdate`: usar lista blanca
   de campos, para que el cliente no pueda escribir `empresa`, `_id` o `estado`.
5. **Nunca** devolver contraseñas ni hashes de contraseña en una respuesta.
6. **Registrar la ruta** en la tabla de arriba.

---

## 5. Verificación

### 5.1 Lista de comprobación manual

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | `GET /api/usuarios` sin token | `401` |
| 2 | `GET /api/usuarios` con token de Mesero | `403` |
| 3 | `GET /api/usuarios` con token de Admin | `200`, **sin** campo `contraseña`, **solo** usuarios de su empresa |
| 4 | `POST /api/auth/register` sin token | `401` |
| 5 | `POST /api/auth/register` con `rol: "Admin"` de un Mesero | `403` |
| 6 | `POST /api/auth/register` con body `empresa: "<id ajeno>"` | el usuario queda en la empresa del Admin, no en la ajena |
| 7 | `POST /api/empresa` (ruta antigua, sin token) | `404` (la ruta ya no existe) |
| 8 | `GET /api/empresa` (ruta antigua, sin token) | `404` |
| 9 | `PUT /api/empresa/mi` con `pagoRealizado: true` | el campo **no** cambia |
| 10 | `DELETE /api/empresa/mi` sin `confirmarContraseña` | `400` |
| 11 | `GET /api/menues` sin token | `401` |
| 12 | `DELETE /api/comandas` (todas) con token de Mesero | `403` |

### 5.2 Pruebas automáticas

```bash
cd Backend
npm test
```

La suite vive en `Backend/test/` y usa el runner nativo de Node
(`node --test`) + `supertest`. Levanta una base de datos de pruebas separada
(definir `MONGO_URI_TEST`) y verifica de forma automática que:

- las rutas protegidas responden `401`/`403` sin credenciales válidas;
- un usuario de la empresa A **no** puede leer ni modificar datos de la
  empresa B;
- las respuestas de usuarios **nunca** incluyen el hash de contraseña.

---

## 6. Historial de cambios

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-19 | `GET /api/usuarios` pasó a exigir token + rol Admin | Era público y devolvía los usuarios de **todas** las empresas con hash de contraseña |
| 2026-10-19 | `GET/POST/PUT/DELETE /api/empresa` reorganizadas | Eran públicas: cualquiera podía listar, crear y **borrar** empresas |
| 2026-10-19 | `POST /api/auth/register` pasó a exigir token + rol Admin | Era pública y aceptaba `rol: "Admin"` → escalación de privilegios |
| 2026-10-19 | Nueva `POST /api/empresa/registro` (pública, transaccional) | Reemplaza el alta improvisada de empresa + admin, ahora atómica y con contraseña hasheada |
| 2026-10-19 | `JWT_SECRET` unificado y obligatorio en producción | El secreto de firma y el de verificación tenían nombres distintos (`JWT_SECRET` vs `SECRET`) y caían a `"secreto123"` |
| 2026-10-19 | Roles `Admin` / `Mesero` / `Cocina` | El enum era `Admin` / `Vendedor`, insuficiente para el flujo de cocina |
| 2026-10-19 | `req.empresaId` + `utils/scope.js` | Centraliza de dónde sale la empresa del usuario para filtrar SIEMPRE |
| 2026-10-19 | CORS restringido a `CLIENT_ORIGIN` | Era `cors()` abierto a cualquier origen |
| 2026-10-19 | Manejador central de errores y 404 en JSON | Los errores se devolvían como HTML con stack trace |
