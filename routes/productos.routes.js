const express = require('express');
const router = express.Router();
const { 
    obtenerProductos, agregarProductos, actualizarProducto, eliminarProducto
} = require('../controllers/productos.controller');
const { verificarToken } = require('../middlewares/auth.middleware')
const { permitirRoles } = require('../middlewares/rol.middleware')

router.get('/', obtenerProductos);
router.post('/', verificarToken, permitirRoles('Admin'), agregarProductos);
router.put('/:id', verificarToken, permitirRoles('Admin'), actualizarProducto);
router.delete('/:id', verificarToken, permitirRoles('Admin'), eliminarProducto);

module.exports = router;