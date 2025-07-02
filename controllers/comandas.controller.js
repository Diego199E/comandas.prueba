const Comanda = require('../models/comanda.model');

// Obtener comandas solo de la empresa del usuario y no completadas
const getComandas = async (req, res) => {
  try {
    const comandas = await Comanda.find({
      estado: false,
      empresa: req.usuario.empresa, // Solo de su empresa
    });
    res.json(comandas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener comandas' });
  }
};

const crearComanda = async (req, res) => {
  try {
    const { mesa, platillos } = req.body;
    const nuevaComanda = new Comanda({
      mesa,
      platillos,
      empresa: req.usuario.empresa, // Asociar con su empresa
    });
    await nuevaComanda.save();
    res.status(201).json(nuevaComanda);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear comanda' });
  }
};

const completarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const comanda = await Comanda.findByIdAndUpdate(
      id,
      { estado: true },
      { new: true }
    );
    if (!comanda) return res.status(404).json({ mensaje: 'Comanda no encontrada' });
    res.json({ mensaje: 'Comanda marcada como completada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al completar comanda' });
  }
};

module.exports = {
  getComandas,
  crearComanda,
  completarComanda,
};
