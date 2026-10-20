// routes/productos.routes.js
const express = require("express");
const router = express.Router();

const {
  crearProducto,
  obtenerProductos,
  actualizarProducto,
  eliminarProducto
} = require("../controllers/productos.controller");

const { verificarToken } = require("../middlewares/auth.middleware");
const { verificarEmpresaActiva } = require("../middlewares/empresa.middleware");
const { permitirRoles } = require("../middlewares/rol.middleware");

// Proteger todas las rutas con token y empresa activa
router.use(verificarToken, verificarEmpresaActiva);

// Lectura: admin y mesero.
// Escritura: solo admin (la receta de un producto es un dato sensible del
// restaurante y no se modifica desde el salón).
router.get("/", permitirRoles("Admin", "Mesero"), obtenerProductos);

router.post("/", permitirRoles("Admin"), crearProducto);
router.put("/:id", permitirRoles("Admin"), actualizarProducto);
router.delete("/:id", permitirRoles("Admin"), eliminarProducto);

module.exports = router;
