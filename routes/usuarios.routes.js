// routes/usuarios.routes.js
const express = require('express');
const router = express.Router();
const {
  obtenerUsuarios,
  actualizarUsuario,
  eliminarUsuario,
} = require('../controllers/usuarios.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

// IMPORTANTE: el router.use() va ANTES de las rutas.
// Si el GET se declarara antes, Express responderia y el middleware de
// autenticacion nunca se ejecutaria (esa fuga devolvia los usuarios de todas
// las empresas, con hash de contrasena incluido).
router.use(verificarToken, verificarEmpresaActiva, permitirRoles('Admin'));

router.get('/', obtenerUsuarios);

// El alta de usuarios esta en POST /api/auth/register (misma proteccion).
router.put('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

module.exports = router;
