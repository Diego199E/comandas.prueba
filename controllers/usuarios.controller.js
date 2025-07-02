//CRUD basico 
const Usuario = require('../models/usuario.model');
const Empresa = require('../models/empresa.model');
const bcrypt = require('bcrypt');

const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find().populate("empresa", "nombre");
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los usuarios', error });
  }
};


const crearUsuario = async (req, res) => {
  try {
    const { nombre, apellido, correo, rol, contraseña } = req.body;

    // Buscar la empresa por su ID o nombre
    const empresaEncontrada = await Empresa.findOne({ nombre: empresa });

    if (!empresaEncontrada) {
      return res.status(400).json({ mensaje: '❌ La empresa no existe' });
    }

    const nuevoUsuario = new Usuario({
      nombre,
      apellido,
      correo,
      rol: rol === 'Admin' && req.usuario?.rol === 'Admin' ? 'Admin' : 'Vendedor',
      contraseña,
      empresa: empresaEncontrada._id,
      plan: empresaEncontrada.estado,
      activo: empresaEncontrada.activa
    });

    const usuarioGuardado = await nuevoUsuario.save();
    res.status(201).json(usuarioGuardado);

  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear el usuario', error });
  }
};


const actualizarUsuario = async (req, res) => {
  try {
    const { nuevaContraseña, confirmarContraseñaAdmin, ...otrosDatos } = req.body;

    const usuarioAdmin = req.usuario; // viene del middleware verificarToken

    // Si se quiere cambiar la contraseña, validamos
    if (nuevaContraseña) {
      if (!confirmarContraseñaAdmin) {
        return res.status(400).json({ mensaje: 'Debes confirmar tu contraseña para hacer este cambio.' });
      }

      const adminReal = await Usuario.findById(usuarioAdmin._id);
      const contraseñaCorrecta = await bcrypt.compare(confirmarContraseñaAdmin, adminReal.contraseña);

      if (!contraseñaCorrecta) {
        return res.status(401).json({ mensaje: 'Contraseña de administrador incorrecta.' });
      }

      otrosDatos.contraseña = await bcrypt.hash(nuevaContraseña, 10);
    }

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      req.params.id,
      otrosDatos,
      { new: true }
    ).populate("empresa"); // por si quieres devolver los datos completos

    if (!usuarioActualizado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ mensaje: 'Error al actualizar el usuario', error });
  }
};


const eliminarUsuario = async (req, res) => {
  try {
    const usuarioEliminado = await Usuario.findByIdAndDelete(req.params.id);

    if (!usuarioEliminado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el usuario', error });
  }
};





module.exports = {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
};
