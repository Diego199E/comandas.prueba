import Ingrediente from "../models/ingrediente.model.js";

// Crear ingrediente
export const crearIngrediente = async (req, res) => {
  try {
    const { nombre, cantidad, unidad = "unidades" } = req.body;
    const ingrediente = new Ingrediente({
      nombre,
      cantidad,
      unidad,
      empresa: req.usuario.empresa,
    });
    await ingrediente.save();
    res.status(201).json(ingrediente);
  } catch (error) {
    res.status(500).json({ error: "Error al crear ingrediente" });
  }
};

// Obtener todos los ingredientes de la empresa
export const obtenerIngredientes = async (req, res) => {
  try {
    const ingredientes = await Ingrediente.find({ empresa: req.usuario.empresa }).sort({ nombre: 1 });
    res.json(ingredientes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ingredientes" });
  }
};

// Actualizar ingrediente
export const actualizarIngrediente = async (req, res) => {
  try {
    const { id } = req.params;
    const ingrediente = await Ingrediente.findOneAndUpdate(
      { _id: id, empresa: req.usuario.empresa },
      req.body,
      { new: true }
    );
    res.json(ingrediente);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar ingrediente" });
  }
};

// Eliminar ingrediente
export const eliminarIngrediente = async (req, res) => {
  try {
    const { id } = req.params;
    await Ingrediente.findOneAndDelete({ _id: id, empresa: req.usuario.empresa });
    res.json({ mensaje: "Ingrediente eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar ingrediente" });
  }
};
