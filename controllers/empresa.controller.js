const Empresa = require('../models/empresa.model');

const getEmpresas = async (req, res) => {
  try {
    const empresas = await Empresa.find().sort({ createdAt: -1 }); // ordena por más reciente
    res.json(empresas);
  } catch (error) {
    console.error("Error al obtener empresas:", error);
    res.status(500).json({ mensaje: "Error al obtener empresas" });
  }
};


const registrarEmpresa = async (req, res) => {
  try {
    const { nombre, nit, razonSocial, estado = 'gratis', activa = false } = req.body;


    // Validación de campos obligatorios
    if (!nombre || !nit || !razonSocial) {
      return res.status(400).json({ mensaje: "❌ Faltan datos obligatorios" });
    }

    // Verificar si ya existe
    const empresaExistente = await Empresa.findOne({ nombre });
    if (empresaExistente) {
      return res.status(400).json({ mensaje: '❌ La empresa ya existe' });
    }

    const empresaConNIT = await Empresa.findOne({ nit });
    if (empresaConNIT) {
      return res.status(400).json({ mensaje: '❌ Ya existe una empresa con ese NIT' });
    }


    const nuevaEmpresa = new Empresa({ nombre, nit, razonSocial, estado, activa });
    const empresaGuardada = await nuevaEmpresa.save();

    res.status(201).json({
      mensaje: '✅ Empresa registrada con éxito',
      empresa: empresaGuardada
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar empresa', error });
    console.error("Error detallado al registrar:", error); // 👈 Agrega esta línea
    res.status(500).json({ mensaje: 'Error al registrar', error });
  }
};

const actualizarEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, nit, razonSocial,pagoRealizado,activa } = req.body;

    const empresaConNIT = await Empresa.findOne({ nit, _id: { $ne: id } });

    if (empresaConNIT) {
      return res.status(400).json({ mensaje: '❌ Ya existe una empresa con ese NIT' });
    }


    const actualizada = await Empresa.findByIdAndUpdate(
      id,
      { nombre, nit, razonSocial,pagoRealizado,activa },
      { new: true }
    );

    res.json({ mensaje: "Empresa actualizada", empresa: actualizada });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: "Error al actualizar empresa" });
  }
};


const Usuario = require("../models/usuario.model"); // Asegúrate de importarlo
const Plato = require("../models/plato.model");
const Comanda = require("../models/comanda.model");

const eliminarEmpresa = async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar todos los datos relacionados con esta empresa
    await Usuario.deleteMany({ empresa: id });
    await Plato.deleteMany({ empresa: id });
    await Comanda.deleteMany({ empresa: id });

    const empresa = await Empresa.findByIdAndDelete(id);
    if (!empresa) return res.status(404).json({ mensaje: "Empresa no encontrada" });

    res.json({ mensaje: "Empresa y datos relacionados eliminados con éxito" });
  } catch (error) {
    console.error("Error al eliminar empresa:", error);
    res.status(500).json({ mensaje: "Error al eliminar empresa" });
  }
};


module.exports = { getEmpresas, registrarEmpresa, actualizarEmpresa, eliminarEmpresa, };
