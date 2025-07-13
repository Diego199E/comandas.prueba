const express = require('express');
const router = express.Router();

const {
  getComandas,
  crearComanda,
  completarComanda,
  eliminarComanda,
  eliminarTodasLasComandas,
  editarComanda, // ✅ asegurado
} = require('../controllers/comandas.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');

// ✅ Aplica protección a todas las rutas de comandas
router.use(verificarToken, verificarEmpresaActiva);

// ✅ Obtener todas las comandas (activas o no) de la empresa
router.get('/', getComandas);

// ✅ Crear una nueva comanda
router.post('/', crearComanda);

// ✅ Editar una comanda existente (por ejemplo, cambiar un plato)
router.put('/:id', editarComanda);

// ✅ Marcar una comanda como completada
router.patch('/:id', completarComanda);

// ✅ Eliminar una comanda
router.delete('/:id', eliminarComanda);

// ✅ Eliminar todas las comandas de la empresa actual
router.delete('/', eliminarTodasLasComandas);

module.exports = router;
