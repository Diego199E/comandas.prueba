// routes/menues.routes.js
const express = require("express");
const {
  crearPlatoMenu,
  obtenerPlatosMenu,
  actualizarPlatoMenu,
  eliminarPlatoMenu,
  obtenerPlatosMenuPublico,
} = require("../controllers/menues.controller.js");

const router = express.Router();

// Privadas
router.post("/", crearPlatoMenu);
router.get("/", obtenerPlatosMenu);
router.put("/:id", actualizarPlatoMenu);
router.delete("/:id", eliminarPlatoMenu);

// Pública (landing page sin token)
router.get("/public/:slug", obtenerPlatosMenuPublico);


module.exports = router;
