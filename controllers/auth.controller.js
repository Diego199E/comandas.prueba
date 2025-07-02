//Controles para el login y registro
const Usuario = require('../models/usuario.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'secreto123';

const registrar = async (req, res) => {
    try {
        const { nombre, apellido, correo, rol, contraseña, empresa } = req.body;

        const usuarioExistente = await Usuario.findOne({ correo });
        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'El correo ya está en uso' });
        }

        // Si hay un usuario autenticado, solo puede asignar admin si es Admin
        const rolFinal = req.usuario ? (req.usuario.rol === 'Admin' ? rol : 'Vendedor') : rol;

        const hash = await bcrypt.hash(contraseña, 10);

        const nuevoUsuario = new Usuario({
            nombre,
            apellido,
            correo,
            rol: rolFinal,
            contraseña: hash,
            empresa: req.usuario?.empresa || empresa // 👈 importante
        });

        const usuarioGuardado = await nuevoUsuario.save();

        res.status(201).json({
            mensaje: 'Usuario registrado con éxito',
            usuario: usuarioGuardado
        });
    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ mensaje: 'Error al registrar', error });
    }
};


const login = async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        const usuario = await Usuario.findOne({ correo }).populate('empresa');
        if (!usuario) {
            return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
        }

        const coinciden = await bcrypt.compare(contraseña, usuario.contraseña);
        if (!coinciden) {
            return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
        }

        const token = jwt.sign({ id: usuario._id, correo: usuario.correo, rol: usuario.rol, empresa: usuario.empresa?.nombre }, SECRET, { expiresIn: '8h' });

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
            }
        });
    } catch (error) {
        console.error("❌ Error en login:", error);
        res.status(500).json({ mensaje: 'Error al iniciar sesión', error });
    }

};

module.exports = { registrar, login };
