// routes/platos.routes.js
const express = require('express');
const router = express.Router();
const {
    obtenerPlatos,
    agregarPlato,
    actualizarPlato,
    eliminarPlato,
} = require('../controllers/platos.controller');
const { verificarToken } = require('../middlewares/auth.middleware')
const { permitirRoles } = require('../middlewares/rol.middleware')
const {verificarEmpresaActiva} = require('../middlewares/empresa.middleware');

// Protegida para todos los usuarios activos
router.get('/', verificarToken, verificarEmpresaActiva, obtenerPlatos);

// Solo admins con empresa activa pueden modificar platos
router.post('/', verificarToken, verificarEmpresaActiva, permitirRoles('Admin'), agregarPlato);
router.put('/:id', verificarToken, verificarEmpresaActiva, permitirRoles('Admin'), actualizarPlato);
router.delete('/:id', verificarToken, verificarEmpresaActiva, permitirRoles('Admin'), eliminarPlato);

module.exports = router;
