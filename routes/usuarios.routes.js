const express = require('express');
const router = express.Router();
const { 
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
} = require('../controllers/usuarios.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

// Aplica a todas las rutas: debe estar logueado y con empresa activa
router.use(verificarToken, verificarEmpresaActiva, permitirRoles("Admin"));


// Rutas protegidas para admin
router.get('/', obtenerUsuarios);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

module.exports = router;
