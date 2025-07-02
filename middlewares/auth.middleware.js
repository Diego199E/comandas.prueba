const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');
const SECRET = process.env.SECRET || 'secreto123';

const verificarToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // solo toma el token, no el "Bearer"


  if (!token) return res.status(401).json({ mensaje: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, SECRET);
    const usuario = await Usuario.findById(decoded.id).populate('empresa'); // ⬅️ Traer usuario
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    req.usuario = usuario; // ⬅️ Guardar usuario completo
    next();
  } catch (err) {
    console.error('❌ Error al verificar token:', err);
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};


module.exports = { verificarToken };

