import PlatoMenu from "../models/platoMenu.model.js";

// Crear plato del menú
export const crearPlatoMenu = async (req, res) => {
  try {
    const { nombre, productos } = req.body;
    const plato = new PlatoMenu({
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
    const platos = await PlatoMenu.find({ empresa: req.usuario.empresa }).populate("productos");
    res.json(platos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener platos del menú" });
  }
};

// Actualizar plato
export const actualizarPlatoMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const plato = await PlatoMenu.findOneAndUpdate(
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
    await PlatoMenu.findOneAndDelete({ _id: id, empresa: req.usuario.empresa });
    res.json({ mensaje: "Plato de menú eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar plato de menú" });
  }
};
