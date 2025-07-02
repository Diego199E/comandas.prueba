const Empresa = require('../models/empresa.model');

const registrarEmpresa = async (req, res) => {
  try {
    const { nombre, estado = 'gratis', activa = false } = req.body;

    // Verificar si ya existe
    const empresaExistente = await Empresa.findOne({ nombre });
    if (empresaExistente) {
      return res.status(400).json({ mensaje: '❌ La empresa ya existe' });
    }

    const nuevaEmpresa = new Empresa({ nombre, estado, activa });
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

module.exports = { registrarEmpresa };
