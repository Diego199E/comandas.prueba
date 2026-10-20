// routes/menues.routes.js
const express = require("express");
const {
  crearPlatoMenu,
  obtenerPlatosMenu,
  actualizarPlatoMenu,
  eliminarPlatoMenu,
  obtenerPlatosMenuPublico,
} = require("../controllers/menues.controller.js");

const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarEmpresaActiva } = require("../middlewares/empresa.middleware");
const { permitirRoles } = require("../middlewares/rol.middleware");

const router = express.Router();

// --- Ruta publica -------------------------------------------------------------
// Se declara PRIMERO a proposito: en Express, un router.use() se aplica a
// todas las rutas que se registren despues de el. Si esta ruta se declarara
// despues, pasaria por verificarToken y el menu publico dejaria de ser
// publico.
router.get("/public/:slug", obtenerPlatosMenuPublico);

// --- Rutas privadas ------------------------------------------------------------
// Solo el Admin de la empresa puede ver o modificar el menu.
router.use(verificarToken, verificarEmpresaActiva, permitirRoles("Admin"));

router.post("/", crearPlatoMenu);
router.get("/", obtenerPlatosMenu);
router.put("/:id", actualizarPlatoMenu);
router.delete("/:id", eliminarPlatoMenu);

module.exports = router;
