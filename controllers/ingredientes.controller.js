// controllers/ingredientes.controller.js
const Ingrediente = require('../models/ingrediente.model');

const { filtroEmpresa, empresaIdDe } = require('../utils/scope');
const { soloCampos } = require('../utils/campos');

// Campos que el cliente puede escribir de un ingrediente.
// 'empresa' y '_id' quedan fuera: son del servidor.
const CAMPOS_INGREDIENTE = ['nombre', 'cantidad', 'unidad', 'disponible'];

// Crear ingrediente
const crearIngrediente = async (req, res) => {
  try {
    const { nombre, cantidad, unidad = 'unidades', disponible } = soloCampos(
      req.body,
      CAMPOS_INGREDIENTE
    );

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del ingrediente es obligatorio' });
    }
    if (cantidad === undefined || Number.isNaN(Number(cantidad))) {
      return res.status(400).json({ error: 'La cantidad no es valida' });
    }

    const ingrediente = new Ingrediente({
      nombre,
      cantidad: Number(cantidad),
      unidad,
      ...(disponible !== undefined ? { disponible: Boolean(disponible) } : {}),
      empresa: empresaIdDe(req),
    });
    await ingrediente.save();
    res.status(201).json(ingrediente);
  } catch (error) {
    console.error('Error al crear ingrediente:', error);
    res.status(500).json({ error: 'Error al crear ingrediente' });
  }
};

// Obtener todos los ingredientes de la empresa
const obtenerIngredientes = async (req, res) => {
  try {
    const ingredientes = await Ingrediente.find(filtroEmpresa(req)).sort({ nombre: 1 });
    res.json(ingredientes);
  } catch (error) {
    console.error('Error al obtener ingredientes:', error);
    res.status(500).json({ error: 'Error al obtener ingredientes' });
  }
};

// Actualizar ingrediente
const actualizarIngrediente = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = soloCampos(req.body, CAMPOS_INGREDIENTE);

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    if (datos.cantidad !== undefined) {
      const cantidad = Number(datos.cantidad);
      if (Number.isNaN(cantidad) || cantidad < 0) {
        return res.status(400).json({ error: 'La cantidad no es valida' });
      }
      datos.cantidad = cantidad;
    }

    // El filtro por empresa impide modificar ingredientes de otra empresa.
    const ingrediente = await Ingrediente.findOneAndUpdate(
      filtroEmpresa(req, { _id: id }),
      datos,
      { new: true }
    );

    if (!ingrediente) {
      return res.status(404).json({ error: 'Ingrediente no encontrado' });
    }

    res.json(ingrediente);
  } catch (error) {
    console.error('Error al actualizar ingrediente:', error);
    res.status(500).json({ error: 'Error al actualizar ingrediente' });
  }
};

// Eliminar ingrediente
const eliminarIngrediente = async (req, res) => {
  try {
    const { id } = req.params;
    const ingrediente = await Ingrediente.findOneAndDelete(filtroEmpresa(req, { _id: id }));

    if (!ingrediente) {
      return res.status(404).json({ error: 'Ingrediente no encontrado' });
    }

    res.json({ mensaje: 'Ingrediente eliminado' });
  } catch (error) {
    console.error('Error al eliminar ingrediente:', error);
    res.status(500).json({ error: 'Error al eliminar ingrediente' });
  }
};

module.exports = {
  crearIngrediente,
  obtenerIngredientes,
  actualizarIngrediente,
  eliminarIngrediente,
};
