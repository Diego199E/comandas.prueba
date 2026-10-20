// controllers/menues.controller.js
import Plato from "../models/plato.model.js";
import Empresa from "../models/empresa.model.js";

import { filtroEmpresa, empresaIdDe } from "../utils/scope.js";
import { soloCampos } from "../utils/campos.js";

// Campos que el cliente puede escribir de un plato de menu.
// 'empresa' y '_id' quedan fuera: son del servidor.
const CAMPOS_MENU = ["nombre", "productos"];

// Crear plato del menú
export const crearPlatoMenu = async (req, res) => {
  try {
    const { nombre, productos } = soloCampos(req.body, CAMPOS_MENU);

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del plato es obligatorio" });
    }

    const plato = new Plato({
      nombre,
      productos,
      empresa: empresaIdDe(req),
    });
    await plato.save();
    res.status(201).json(plato);
  } catch (error) {
    console.error("Error al crear plato de menú:", error);
    res.status(500).json({ error: "Error al crear plato de menú" });
  }
};

// Obtener platos del menú
export const obtenerPlatosMenu = async (req, res) => {
  try {
    const platos = await Plato.find(filtroEmpresa(req));
    res.json(platos);
  } catch (error) {
    console.error("Error al obtener platos del menú:", error);
    res.status(500).json({ error: "Error al obtener platos del menú" });
  }
};

// Actualizar plato
export const actualizarPlatoMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = soloCampos(req.body, CAMPOS_MENU);

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    // El filtro por empresa impide modificar platos de otra empresa.
    const plato = await Plato.findOneAndUpdate(filtroEmpresa(req, { _id: id }), datos, {
      new: true,
    });

    if (!plato) {
      return res.status(404).json({ error: "Plato no encontrado" });
    }

    res.json(plato);
  } catch (error) {
    console.error("Error al actualizar plato del menú:", error);
    res.status(500).json({ error: "Error al actualizar plato del menú" });
  }
};

// Eliminar plato
export const eliminarPlatoMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const plato = await Plato.findOneAndDelete(filtroEmpresa(req, { _id: id }));

    if (!plato) {
      return res.status(404).json({ error: "Plato no encontrado" });
    }

    res.json({ mensaje: "Plato de menú eliminado" });
  } catch (error) {
    console.error("Error al eliminar plato de menú:", error);
    res.status(500).json({ error: "Error al eliminar plato de menú" });
  }
};

// Obtener platos del menú de una empresa (público, sin token)
export const obtenerPlatosMenuPublico = async (req, res) => {
  try {
    const { slug } = req.params;

    // Buscar la empresa por el slug
    const empresa = await Empresa.findOne({ slug });
    if (!empresa) {
      return res.status(404).json({ mensaje: "Empresa no encontrada" });
    }

    // Buscar los platos asociados a esa empresa y que estén disponibles
    const platos = await Plato.find({ empresa: empresa._id, disponible: true });

    if (!platos.length) {
      return res.status(404).json({ mensaje: "No hay platos para esta empresa" });
    }

    res.json(platos);
  } catch (error) {
    console.error("❌ Error en obtenerPlatosMenuPublico:", error);
    res.status(500).json({ error: "Error al obtener menú público" });
  }
};
