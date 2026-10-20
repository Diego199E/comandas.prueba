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
} = require('../controllers/comandas.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

// ✅ Aplica protección a todas las rutas de comandas
router.use(verificarToken, verificarEmpresaActiva);

// ✅ Obtener todas las comandas (activas o no) de la empresa
router.get('/', getComandas);

// ✅ Crear una nueva comanda
router.post('/', crearComanda);

// ✅ Marcar una comanda como impresa
router.patch('/:id/imprimir', marcarComoImpresa);

// ✅ Editar una comanda existente (por ejemplo, cambiar un plato)
router.put('/:id', editarComanda);

// ✅ Marcar una comanda como completada
router.patch('/:id', completarComanda);

// ✅ Eliminar una comanda
router.delete('/:id', eliminarComanda);

// ✅ Eliminar todas las comandas de la empresa actual (solo Admin)
router.delete('/', permitirRoles('Admin'), eliminarTodasLasComandas);

module.exports = router;
