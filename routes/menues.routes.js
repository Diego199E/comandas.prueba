import express from "express";
import {
  crearPlatoMenu,
  obtenerPlatosMenu,
  actualizarPlatoMenu,
  eliminarPlatoMenu
} from "../controllers/menues.controller.js";
import verificarToken from "../middlewares/auth.middleware.js";
import verificarEmpresaActiva from "../middlewares/empresa.middleware.js";

const router = express.Router();

//router.use(verificarToken, verificarEmpresaActiva);

router.post("/", crearPlatoMenu);
router.get("/", obtenerPlatosMenu);
router.put("/:id", actualizarPlatoMenu);
router.delete("/:id", eliminarPlatoMenu);

module.exports = router;
