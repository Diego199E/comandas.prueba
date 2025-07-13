const Comanda = require('../models/comanda.model');
const Empresa = require('../models/empresa.model');

// Obtener comandas solo de la empresa del usuario y no completadas
const getComandas = async (req, res) => {
  try {
    const comandas = await Comanda.find({
      empresa: req.usuario.empresa,
    }).populate("usuario", "nombre");
    res.json(comandas);
  } catch (error) {
    console.error("Error al obtener comandas:", error); // IMPORTANTE
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
      usuario: req.usuario._id, // ← esto permite luego usar populate("usuario")
      usaIva: empresa.usaIva || false,
    });

    await nuevaComanda.save();
    res.status(201).json(nuevaComanda);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear comanda' });
  }
};

const editarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { platillos } = req.body;

    const comanda = await Comanda.findOne({
      _id: id,
      empresa: req.usuario.empresa, // garantiza que no edite otra empresa
    });

    if (!comanda) {
      return res.status(404).json({ mensaje: "Comanda no encontrada" });
    }

    comanda.platillos = platillos;
    await comanda.save();

    res.json({ mensaje: "✅ Comanda actualizada con éxito", comanda });
  } catch (error) {
    console.error("❌ Error al editar comanda:", error);
    res.status(500).json({ mensaje: "Error al editar comanda" });
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

// Borra todas las comandas de la empresa actual
const eliminarTodasLasComandas = async (req, res) => {
  try {
    const empresaId = req.usuario.empresa;
    await Comanda.deleteMany({ empresa: empresaId });
    res.json({ mensaje: "Todas las comandas fueron eliminadas correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar todas las comandas:", error);
    res.status(500).json({ mensaje: "Error al eliminar todas las comandas" });
  }
};

module.exports = {
  // otros controladores...
  eliminarTodasLasComandas,
};



module.exports = {
  getComandas,
  crearComanda,
  editarComanda,
  completarComanda,
  eliminarComanda,
  eliminarTodasLasComandas,
};
