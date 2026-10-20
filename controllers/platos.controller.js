// controllers/platos.controller.js
const Plato = require('../models/plato.model');

const { filtroEmpresa, empresaIdDe } = require('../utils/scope');
const { soloCampos } = require('../utils/campos');

// Campos que el cliente puede escribir de un plato.
// 'empresa' y '_id' quedan fuera: son del servidor.
const CAMPOS_PLATO = ['nombre', 'precio', 'cantidad', 'disponible', 'contenido'];

// Obtener platos solo de la empresa del usuario
const obtenerPlatos = async (req, res) => {
  try {
    const platos = await Plato.find(filtroEmpresa(req)).populate('empresa');
    res.json(platos);
  } catch (error) {
    console.error('Error al obtener los platos:', error);
    res.status(500).json({ mensaje: 'Error al obtener los platos' });
  }
};

const agregarPlato = async (req, res) => {
  try {
    const datos = soloCampos(req.body, CAMPOS_PLATO);

    if (!datos.nombre || datos.precio === undefined) {
      return res.status(400).json({ mensaje: 'El nombre y el precio son obligatorios' });
    }

    const nuevoPlato = new Plato({
      ...datos,
      empresa: empresaIdDe(req), // La empresa SIEMPRE es la del usuario autenticado.
    });

    const platoGuardado = await nuevoPlato.save();
    res.status(201).json(platoGuardado);
  } catch (error) {
    console.error('Error al agregar el plato:', error);
    res.status(500).json({ mensaje: 'Error al agregar el plato' });
  }
};

const actualizarPlato = async (req, res) => {
  try {
    const datos = soloCampos(req.body, CAMPOS_PLATO);

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    // El filtro por empresa impide modificar platos de otra empresa.
    const platoActualizado = await Plato.findOneAndUpdate(
      filtroEmpresa(req, { _id: req.params.id }),
      datos,
      { new: true }
    );

    if (!platoActualizado) {
      return res.status(404).json({ mensaje: 'Plato no encontrado' });
    }

    res.json(platoActualizado);
  } catch (error) {
    console.error('Error al actualizar el plato:', error);
    res.status(400).json({ mensaje: 'Error al actualizar el plato' });
  }
};

const eliminarPlato = async (req, res) => {
  try {
    // El filtro por empresa impide borrar platos de otra empresa.
    const platoEliminado = await Plato.findOneAndDelete(
      filtroEmpresa(req, { _id: req.params.id })
    );

    if (!platoEliminado) {
      return res.status(404).json({ mensaje: 'Plato no encontrado' });
    }

    res.json({ mensaje: 'Plato eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el plato:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el plato' });
  }
};

module.exports = {
  obtenerPlatos,
  agregarPlato,
  actualizarPlato,
  eliminarPlato,
};
