// routes/turnos.routes.js
const express = require('express');
const router = express.Router();

const {
  obtenerTurnos,
  obtenerTurno,
  abrirTurno,
  cerrarTurno,
} = require('../controllers/turnos.controller');

const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

router.use(verificarToken, verificarEmpresaActiva);

// Abrir y cerrar turnos es una decision del negocio: solo lo hace el admin.
router.get('/', permitirRoles('Admin'), obtenerTurnos);
router.get('/:id', permitirRoles('Admin'), obtenerTurno);
router.post('/', permitirRoles('Admin'), abrirTurno);
router.patch('/:id/cierre', permitirRoles('Admin'), cerrarTurno);

module.exports = router;
