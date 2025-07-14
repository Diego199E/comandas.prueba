const express = require("express");
const router = express.Router();

const {
  crearIngrediente,
  obtenerIngredientes,
  actualizarIngrediente,
  eliminarIngrediente,
} = require("../controllers/ingredientes.controller");

const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarEmpresaActiva } = require("../middlewares/empresa.middleware");

// Proteger todas las rutas
router.use(verificarToken, verificarEmpresaActiva);

// CRUD básico
router.post("/", crearIngrediente);
router.get("/", obtenerIngredientes);
router.put("/:id", actualizarIngrediente);
router.delete("/:id", eliminarIngrediente);

module.exports = router;
