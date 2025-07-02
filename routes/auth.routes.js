const express = require('express');
const router = express.Router();
const Usuario = require('../models/usuario.model');
const { verificarToken } = require('../middlewares/auth.middleware');
const { registrar, login } = require('../controllers/auth.controller');
const { verificarEmpresaActiva } = require('../middlewares/empresa.middleware');
const { permitirRoles } = require('../middlewares/rol.middleware');

// Ruta para el login y registro



// Solo admins pueden crear usuarios
router.post(
  '/register',
  verificarToken,
  verificarEmpresaActiva,
  permitirRoles("Admin"),
  registrar,
);



router.post('/login', login);


// Ruta protegida para obtener perfil
router.get('/perfil', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id)
    .populate('empresa', 'nombre activa pago')
    .select('-contraseña'); // ocultamos la contraseña
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json(usuario);

  } catch (err) {
    res.status(500).json({ mensaje: 'Error al obtener el perfil', error: err.message });
  }
});

module.exports = router;
