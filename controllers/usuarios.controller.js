// controllers/usuarios.controller.js
// Gestion de usuarios. Todas las operaciones estan limitadas a la empresa del
// administrador autenticado (aislamiento multi-empresa).
//
// El alta de usuarios NO vive aqui: es POST /api/auth/register, que exige rol
// Admin y guarda la contrasena con bcrypt.
const Usuario = require('../models/usuario.model');
const bcrypt = require('bcrypt');

const { empresaIdDe } = require('../utils/scope');

// Campos que un administrador puede modificar de un usuario.
// 'empresa' queda fuera a proposito: mover un usuario a otra empresa no es
// una operacion de auto-gestion.
const CAMPOS_EDITABLES = ['nombre', 'apellido', 'correo', 'rol'];

/**
 * Lista los usuarios de la empresa del administrador autenticado.
 * Nunca devuelve hashes de contrasena.
 */
const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find({ empresa: empresaIdDe(req) })
      .select('-contraseña')
      .populate('empresa', 'nombre');

    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener los usuarios' });
  }
};

/**
 * Actualiza un usuario de la misma empresa.
 * Para cambiar la contrasena se exige confirmar la del administrador.
 */
const actualizarUsuario = async (req, res) => {
  try {
    const { nuevaContraseña, confirmarContraseñaAdmin, ...otrosDatos } = req.body;

    const usuarioAdmin = req.usuario; // viene del middleware verificarToken

    // Solo se admiten campos de la lista blanca.
    const datos = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (otrosDatos[campo] !== undefined) {
        datos[campo] = otrosDatos[campo];
      }
    }

    if (datos.correo) {
      datos.correo = String(datos.correo).trim().toLowerCase();
    }

    // Si se quiere cambiar la contraseña, validamos
    if (nuevaContraseña) {
      if (!confirmarContraseñaAdmin) {
        return res.status(400).json({
          mensaje: 'Debes confirmar tu contraseña para hacer este cambio.',
        });
      }

      const adminReal = await Usuario.findById(usuarioAdmin._id);
      const contraseñaCorrecta = await bcrypt.compare(
        confirmarContraseñaAdmin,
        adminReal.contraseña
      );

      if (!contraseñaCorrecta) {
        return res.status(401).json({
          mensaje: 'Contraseña de administrador incorrecta.',
        });
      }

      if (String(nuevaContraseña).length < 6) {
        return res.status(400).json({
          mensaje: 'La contraseña debe tener al menos 6 caracteres.',
        });
      }

      datos.contraseña = await bcrypt.hash(nuevaContraseña, 10);
    }

    // El filtro por empresa impide editar usuarios de otra empresa.
    const usuarioActualizado = await Usuario.findOneAndUpdate(
      { _id: req.params.id, empresa: empresaIdDe(req) },
      datos,
      { new: true }
    )
      .select('-contraseña')
      .populate('empresa', 'nombre');

    if (!usuarioActualizado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el usuario' });
  }
};

/**
 * Elimina un usuario de la misma empresa.
 */
const eliminarUsuario = async (req, res) => {
  try {
    // No se puede eliminar a uno mismo (evita quedarse sin administrador).
    if (req.params.id === req.usuario._id) {
      return res.status(400).json({
        mensaje: 'No puedes eliminar tu propio usuario.',
      });
    }

    const usuarioEliminado = await Usuario.findOneAndDelete({
      _id: req.params.id,
      empresa: empresaIdDe(req),
    });

    if (!usuarioEliminado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el usuario' });
  }
};

module.exports = {
  obtenerUsuarios,
  actualizarUsuario,
  eliminarUsuario,
};
