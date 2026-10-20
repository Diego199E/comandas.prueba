// routes/comandas.routes.js
const express = require('express');
const router = express.Router();

const {
  getComandas,
  crearComanda,
  completarComanda,
  eliminarComanda,
  eliminarTodasLasComandas,
  editarComanda,
  marcarComoImpresa,
  actualizarEstadoCocina,
} = require('../controllers/comandas.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

// ✅ Aplica protección a todas las rutas de comandas
router.use(verificarToken, verificarEmpresaActiva);

// ✅ Obtener todas las comandas (activas o no) de la empresa
// La cocina recibe las comandas sin precios (ver ocultarPreciosParaCocina).
router.get('/', getComandas);

// ✅ Crear una nueva comanda (quien toma pedidos: admin o mesero)
router.post('/', permitirRoles('Admin', 'Mesero'), crearComanda);

// ✅ Marcar una comanda como impresa
router.patch('/:id/imprimir', permitirRoles('Admin', 'Mesero'), marcarComoImpresa);

// ✅ Estado del pedido dentro de la cocina (Pendiente -> En preparacion -> Listo)
router.patch(
  '/:id/preparacion',
  permitirRoles('Admin', 'Mesero', 'Cocina'),
  actualizarEstadoCocina
);

// ✅ Editar una comanda existente (por ejemplo, cambiar un plato)
router.put('/:id', permitirRoles('Admin', 'Mesero'), editarComanda);

// ✅ Marcar una comanda como completada (cocina tambien puede hacerlo)
router.patch('/:id', permitirRoles('Admin', 'Mesero', 'Cocina'), completarComanda);

// ✅ Eliminar una comanda (solo Admin: es una accion sobre el historial)
router.delete('/:id', permitirRoles('Admin'), eliminarComanda);

// ✅ Eliminar todas las comandas de la empresa actual (solo Admin)
router.delete('/', permitirRoles('Admin'), eliminarTodasLasComandas);

module.exports = router;
