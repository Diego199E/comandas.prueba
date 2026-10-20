// controllers/auth.controller.js
// Controladores para el login y el registro de usuarios.
const Usuario = require('../models/usuario.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

// Roles validos del sistema. Un rol no contemplado cae en 'Mesero'.
const ROLES_VALIDOS = ['Admin', 'Mesero', 'Cocina'];

/**
 * Registra un usuario DENTRO de la empresa del administrador autenticado.
 *
 * Esta ruta requiere token + rol Admin (ver routes/auth.routes.js).
 * La empresa SIEMPRE se toma de req.empresaId: nunca del body. Asi un
 * administrador no puede crear usuarios en otra empresa.
 */
const registrar = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'Debes iniciar sesión para registrar usuarios' });
    }

    const { nombre, apellido, correo, rol, contraseña } = req.body;

    if (!nombre || !apellido || !correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
    }

    const correoNormalizado = String(correo).trim().toLowerCase();

    const usuarioExistente = await Usuario.findOne({ correo: correoNormalizado });
    if (usuarioExistente) {
      return res.status(400).json({ mensaje: 'El correo ya está en uso' });
    }

    const rolFinal = ROLES_VALIDOS.includes(rol) ? rol : 'Mesero';

    const hash = await bcrypt.hash(contraseña, 10);

    const nuevoUsuario = new Usuario({
      nombre,
      apellido,
      correo: correoNormalizado,
      rol: rolFinal,
      contraseña: hash,
      empresa: req.empresaId,
    });

    const usuarioGuardado = await nuevoUsuario.save();

    // No se devuelve el hash de la contraseña.
    res.status(201).json({
      mensaje: 'Usuario registrado con éxito',
      usuario: {
        _id: usuarioGuardado._id,
        nombre: usuarioGuardado.nombre,
        apellido: usuarioGuardado.apellido,
        correo: usuarioGuardado.correo,
        rol: usuarioGuardado.rol,
        empresa: usuarioGuardado.empresa,
      },
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ mensaje: 'Error al registrar usuario' });
  }
};

/**
 * Autentica a un usuario y devuelve un JWT.
 */
const login = async (req, res) => {
  try {
    const { correo, contraseña } = req.body;

    if (!correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
    }

    const correoNormalizado = String(correo).trim().toLowerCase();

    const usuario = await Usuario.findOne({ correo: correoNormalizado }).populate('empresa');
    if (!usuario) {
      // Mismo mensaje para usuario inexistente y contraseña incorrecta:
      // no se revela que correos estan registrados.
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const coinciden = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!coinciden) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      {
        id: usuario._id,
        correo: usuario.correo,
        rol: usuario.rol,
        empresa: usuario.empresa?.nombre,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const { _id, nombre, correo: correoUsuario, apellido, rol, empresa } = usuario;

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        _id,
        nombre,
        correo: correoUsuario,
        apellido,
        rol,
        empresa,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error al iniciar sesión' });
  }
};

module.exports = { registrar, login };
