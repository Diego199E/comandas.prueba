// routes/empresa.routes.js
const express = require('express');
const router = express.Router();
const {
  registrarEmpresaConAdmin,
  obtenerMiEmpresa,
  actualizarMiEmpresa,
  eliminarMiEmpresa,
  listarEmpresas,
  obtenerEmpresaPorId,
  actualizarEmpresaSuper,
  eliminarEmpresaSuper,
} = require('../controllers/empresa.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

// --- Ruta publica ------------------------------------------------------------
// Alta de una empresa nueva con su primer administrador, en una sola operacion.
// Es el UNICO punto de entrada que crea usuarios fuera del panel.
router.post('/registro', registrarEmpresaConAdmin);

// --- Gestion de la propia empresa ---------------------------------------------
// No existe un super-administrador de plataforma: cada administrador de
// empresa solo administra la suya. Por eso no hay listar-todas ni rutas por id.
router.get('/mi', verificarToken, obtenerMiEmpresa);
router.put('/mi', verificarToken, permitirRoles('Admin'), actualizarMiEmpresa);
router.delete('/mi', verificarToken, permitirRoles('Admin'), eliminarMiEmpresa);

// --- Super admin (local): CRUD completo sobre la tabla empresa ----------------
// Rutas publicas para uso en entorno local (sin autenticacion).
router.get('/listar', listarEmpresas);
router.get('/:id', obtenerEmpresaPorId);
router.put('/:id', actualizarEmpresaSuper);
router.delete('/:id', eliminarEmpresaSuper);

module.exports = router;
