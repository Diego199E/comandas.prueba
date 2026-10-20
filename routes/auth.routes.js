// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario.model');
const { verificarToken } = require('../middlewares/auth.middleware');
const { registrar, login } = require('../controllers/auth.controller');
const { permitirRoles } = require('../middlewares/rol.middleware');
const { limitarPeticiones } = require('../middlewares/rateLimit');

// Login: publica por definicion, pero con limite de intentos para evitar
// ataques de fuerza bruta contra las contrasenas.
router.post(
  '/login',
  limitarPeticiones({
    maximo: 10,
    ventanaMs: 15 * 60 * 1000,
    mensaje: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.',
  }),
  login
);

// Crear usuarios dentro de la empresa:
// SOLO un Admin autenticado puede hacerlo, y el usuario queda siempre
// amarrado a la empresa de ese Admin (nunca a la que venga en el body).
// El alta de una empresa nueva con su primer Admin es POST /api/empresa/registro.
router.post('/register', verificarToken, permitirRoles('Admin'), registrar);

// Ruta protegida para obtener perfil.
router.get('/perfil', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id)
      .populate('empresa', 'nombre nit razonSocial slug activa pagoRealizado usaIva')
      .select('-contraseña'); // ocultamos la contraseña

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json(usuario);
  } catch (err) {
    console.error('Error al obtener el perfil:', err);
    res.status(500).json({ mensaje: 'Error al obtener el perfil' });
  }
});

module.exports = router;
