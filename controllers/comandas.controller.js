const Comanda = require('../models/comanda.model');
const Empresa = require('../models/empresa.model');

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

    const empresa = await Empresa.findById(req.usuario.empresa);
    if (!empresa) {
      return res.status(400).json({ mensaje: "Empresa no encontrada" });
    }

    const nuevaComanda = new Comanda({
      mesa,
      platillos,
      empresa: req.usuario.empresa,
      nitEmpresa: empresa.nit || "",
      razonSocialEmpresa: empresa.razonSocial || "",
    });

    await nuevaComanda.save();
    res.status(201).json(nuevaComanda);
  } catch (error) {
    console.error(error);
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

const eliminarComanda = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByIdAndDelete(id);
    if (!comanda) {
      return res.status(404).json({ mensaje: 'Comanda no encontrada' });
    }

    res.json({ mensaje: '✅ Comanda eliminada con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: '❌ Error al eliminar comanda' });
  }
};


module.exports = {
  getComandas,
  crearComanda,
  completarComanda,
  eliminarComanda,
};
