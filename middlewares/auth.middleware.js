// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');
const { JWT_SECRET } = require('../config/env');

/**
 * Verifica el token Bearer y deja el usuario en req.usuario.
 *
 * Deja ademas req.empresaId con el ObjectId de la empresa del usuario: es el
 * identificador que usan todos los controllers para aislar datos entre
 * empresas (ver utils/scope.js).
 */
const verificarToken = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : header.split(' ')[1];

  if (!token) {
    return res.status(401).json({ mensaje: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).populate('empresa');

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    req.usuario = usuario;

    // Si 'empresa' fue populado es un documento y su _id es el ObjectId real.
    // Si no fue populado, ya es el ObjectId crudo.
    const ref = usuario.empresa;
    req.empresaId = ref ? (ref._id ? ref._id : ref) : null;

    if (!req.empresaId) {
      return res.status(403).json({ mensaje: 'El usuario no tiene empresa asignada' });
    }

    next();
  } catch (err) {
    console.error('❌ Error al verificar token:', err.message);
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

module.exports = { verificarToken };
