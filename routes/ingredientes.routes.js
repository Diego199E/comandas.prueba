// routes/ingredientes.routes.js
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
const { permitirRoles } = require("../middlewares/rol.middleware");

// Proteger todas las rutas
router.use(verificarToken, verificarEmpresaActiva);

// Lectura: admin y mesero.
// Escritura: solo admin (el inventario no se modifica desde el salón).
router.get("/", permitirRoles("Admin", "Mesero"), obtenerIngredientes);

router.post("/", permitirRoles("Admin"), crearIngrediente);
router.put("/:id", permitirRoles("Admin"), actualizarIngrediente);
router.delete("/:id", permitirRoles("Admin"), eliminarIngrediente);

module.exports = router;
