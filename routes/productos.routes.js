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

// Proteger todas las rutas con token y empresa activa
router.use(verificarToken, verificarEmpresaActiva);

// Rutas CRUD
router.post("/", crearProducto);         // Crear nuevo producto
router.get("/", obtenerProductos);       // Obtener todos los productos
router.put("/:id", actualizarProducto);  // Actualizar producto existente
router.delete("/:id", eliminarProducto); // Eliminar producto

module.exports = router;

