// controllers/menues.controller.js
// Menú PÚBLICO de una empresa (para la landing / carta online).
//
// NOTA: el CRUD de menú que.before vivía aquí duplicaba el de /api/platos
// (que es el que usa el panel) y además estaba roto: guardaba un campo
// "productos" que el modelo Plato no tiene y hacia populate() sobre ese
// campo inexistente. Se elimino en favor de /api/platos.
//
// Aqui solo queda la consulta pública, que no necesita token y devuelve
// únicamente los platos marcados como disponibles.
const Plato = require('../models/plato.model');
const Empresa = require('../models/empresa.model');

// Obtener platos del menú de una empresa (público, sin token)
const obtenerPlatosMenuPublico = async (req, res) => {
  try {
    const { slug } = req.params;

    // Buscar la empresa por el slug
    const empresa = await Empresa.findOne({ slug });
    if (!empresa) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    // Buscar los platos asociados a esa empresa y que estén disponibles
    const platos = await Plato.find({ empresa: empresa._id, disponible: true });

    if (!platos.length) {
      return res.status(404).json({ mensaje: 'No hay platos para esta empresa' });
    }

    res.json(platos);
  } catch (error) {
    console.error('❌ Error en obtenerPlatosMenuPublico:', error);
    res.status(500).json({ error: 'Error al obtener menú público' });
  }
};

module.exports = { obtenerPlatosMenuPublico };
