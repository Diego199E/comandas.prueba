const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario.model');
const { verificarToken } = require('../middlewares/auth.middleware');
const { registrar, login } = require('../controllers/auth.controller');


// Ruta para el login y registro
router.post('/register', registrar);
router.post('/login', login);


// Ruta protegida para obtener perfil
router.get('/perfil', verificarToken, async (req, res) => {
    try {
      const usuario = await Usuario.findById(req.usuario._id).select('-contraseña'); // ocultamos la contraseña
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      res.json(usuario);
    } catch (err) {
      res.status(500).json({ mensaje: 'Error al obtener el perfil', error: err.message });
    }
  });

module.exports = router;
