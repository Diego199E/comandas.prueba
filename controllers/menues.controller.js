import Plato from "../models/plato.model.js";
import Empresa from "../models/empresa.model.js";

// Crear plato del menú
export const crearPlatoMenu = async (req, res) => {
  try {
    const { nombre, productos } = req.body;
    const plato = new Plato({
      nombre,
      productos,
      empresa: req.usuario.empresa,
    });
    await plato.save();
    res.status(201).json(plato);
  } catch (error) {
    res.status(500).json({ error: "Error al crear plato de menú" });
  }
};

// Obtener platos del menú
export const obtenerPlatosMenu = async (req, res) => {
  try {
    const platos = await Plato.find({ empresa: req.usuario.empresa }).populate("productos");
    res.json(platos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener platos del menú" });
  }
};

// Actualizar plato
export const actualizarPlatoMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const plato = await Plato.findOneAndUpdate(
      { _id: id, empresa: req.usuario.empresa },
      req.body,
      { new: true }
    );
    res.json(plato);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar plato del menú" });
  }
};

// Eliminar plato
export const eliminarPlatoMenu = async (req, res) => {
  try {
    const { id } = req.params;
    await Plato.findOneAndDelete({ _id: id, empresa: req.usuario.empresa });
    res.json({ mensaje: "Plato de menú eliminado" });
  } catch (error) {
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

