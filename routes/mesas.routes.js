// routes/mesas.routes.js
const express = require('express');
const router = express.Router();

const {
  obtenerMesas,
  crearMesa,
  actualizarMesa,
  eliminarMesa,
} = require('../controllers/mesas.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

router.use(verificarToken, verificarEmpresaActiva);

// Listar y crear mesas: lo necesitan el admin y el mesero.
router.get('/', permitirRoles('Admin', 'Mesero'), obtenerMesas);
router.post('/', permitirRoles('Admin', 'Mesero'), crearMesa);

// Guardar el borrador del pedido o liberar la mesa.
router.put('/:id', permitirRoles('Admin', 'Mesero'), actualizarMesa);

// Borrar una mesa. El controller es mas estricto que el rol: un mesero solo
// puede borrar mesas libres y sin pedido.
router.delete('/:id', permitirRoles('Admin', 'Mesero'), eliminarMesa);

module.exports = router;
