const Comanda = require('../models/comandas.model');

// Obtener todas las comandas

const getComandas = async (req, res) => {
    try {
      const comandas = await Comanda.find({ estado: false }); // Solo las no completadas
      res.json(comandas);
    } catch (error) {
      res.status(500).json({ mensaje: 'Error al obtener comandas' });
    }
  };
  

const crearComanda = async (req, res) => {
    try {
        const { mesa, platillos } = req.body;
        const nuevaComanda = new Comanda({ mesa, platillos });
        await nuevaComanda.save();
        res.status(201).json(nuevaComanda);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear comanda' });
    }
};

// Marcar comanda como completada (eliminar o cambiar estado)
// En controllers/comandas.controller.js
const completarComanda = async (req, res) => {
    try {
        const { id } = req.params;
        const comanda = await Comanda.findByIdAndUpdate(id, { estado: true }, { new: true });
        if (!comanda) return res.status(404).json({ mensaje: 'Comanda no encontrada' });
        res.json({ mensaje: 'Comanda marcada como completada' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al completar comanda' });
    }
};


module.exports = {
    getComandas,
    crearComanda,
    completarComanda
}; 