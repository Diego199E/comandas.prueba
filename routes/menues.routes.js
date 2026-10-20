// routes/menues.routes.js
const express = require('express');
const router = express.Router();

const { obtenerPlatosMenuPublico } = require('../controllers/menues.controller');

// Ruta pública: la carta del restaurante por su slug.
// No requiere token (es la vista para el cliente final).
// El CRUD del menú vive en /api/platos, que es el que usa el panel.
router.get('/public/:slug', obtenerPlatosMenuPublico);

module.exports = router;
