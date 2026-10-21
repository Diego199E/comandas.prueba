// controllers/empresa.controller.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Empresa = require('../models/empresa.model');
const Usuario = require('../models/usuario.model');
const Plato = require('../models/plato.model');
const Comanda = require('../models/comanda.model');
const Producto = require('../models/producto.model');
const Ingrediente = require('../models/ingrediente.model');
const Mesa = require('../models/mesa.model');

const { JWT_SECRET } = require('../config/env');

// Normaliza el NIT: quita espacios y puntos, conserva el digito de control.
const normalizarNit = (nit) => String(nit).replace(/[\s.]/g, '');

/**
 * ALTA PUBLICA DE UNA EMPRESA NUEVA.
 *
 * Crea la empresa y su primer administrador en una sola transaccion: si algo
 * falla, no queda ni empresa sin admin ni admin sin empresa.
 *
 * Es la unica ruta publica que crea usuarios. Todas las demas altas de
 * usuarios pasan por POST /api/auth/register, que exige rol Admin.
 */
const registrarEmpresaConAdmin = async (req, res) => {
  try {
    const {
      nombre,
      nit,
      razonSocial,
      nombreAdmin,
      apellidoAdmin,
      correoAdmin,
      contraseñaAdmin,
      usaIva = true,
    } = req.body;

    // --- Validaciones ---------------------------------------------------------
    const faltantes = [];
    if (!nombre) faltantes.push('nombre');
    if (!nit) faltantes.push('nit');
    if (!razonSocial) faltantes.push('razonSocial');
    if (!nombreAdmin) faltantes.push('nombreAdmin');
    if (!apellidoAdmin) faltantes.push('apellidoAdmin');
    if (!correoAdmin) faltantes.push('correoAdmin');
    if (!contraseñaAdmin) faltantes.push('contraseñaAdmin');

    if (faltantes.length > 0) {
      return res.status(400).json({
        mensaje: `Faltan datos obligatorios: ${faltantes.join(', ')}`,
      });
    }

    const nitNormalizado = normalizarNit(nit);
    if (!/^\d{6,13}(-\d)?$/.test(nitNormalizado)) {
      return res.status(400).json({ mensaje: 'El NIT no tiene un formato válido' });
    }

    const correoNormalizado = String(correoAdmin).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)) {
      return res.status(400).json({ mensaje: 'El correo del administrador no es válido' });
    }

    if (String(contraseñaAdmin).length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // --- Unicidad -------------------------------------------------------------
    const empresaExistente = await Empresa.findOne({
      $or: [{ nit: nitNormalizado }, { nombre: String(nombre).trim() }],
    });
    if (empresaExistente) {
      return res.status(400).json({
        mensaje: 'Ya existe una empresa con ese NIT o con ese nombre',
      });
    }

    const usuarioExistente = await Usuario.findOne({ correo: correoNormalizado });
    if (usuarioExistente) {
      return res.status(400).json({ mensaje: 'El correo ya está en uso' });
    }

    // --- Creacion transaccional ------------------------------------------------
    const hash = await bcrypt.hash(contraseñaAdmin, 10);

    const session = await mongoose.startSession();
    let empresaGuardada;
    let adminGuardado;

    try {
      await session.withTransaction(async () => {
        const [empresa] = await Empresa.create(
          [
            {
              nombre: String(nombre).trim(),
              nit: nitNormalizado,
              razonSocial: String(razonSocial).trim(),
              usaIva: Boolean(usaIva),
              // La empresa queda activa y habilitada desde el inicio: no existe
              // un super-admin que la habilite a posteriori.
              activa: true,
              pagoRealizado: true,
              estado: 'gratis',
            },
          ],
          { session }
        );

        const [admin] = await Usuario.create(
          [
            {
              nombre: String(nombreAdmin).trim(),
              apellido: String(apellidoAdmin).trim(),
              correo: correoNormalizado,
              rol: 'Admin',
              contraseña: hash,
              empresa: empresa._id,
            },
          ],
          { session }
        );

        empresaGuardada = empresa;
        adminGuardado = admin;
      });
    } finally {
      await session.endSession();
    }

    // Token para que el frontend pueda iniciar sesion de inmediato.
    const token = jwt.sign(
      {
        id: adminGuardado._id,
        correo: adminGuardado.correo,
        rol: adminGuardado.rol,
        empresa: empresaGuardada.nombre,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({
      mensaje: 'Empresa y administrador registrados con éxito',
      token,
      empresa: {
        _id: empresaGuardada._id,
        nombre: empresaGuardada.nombre,
        nit: empresaGuardada.nit,
        razonSocial: empresaGuardada.razonSocial,
        slug: empresaGuardada.slug,
        activa: empresaGuardada.activa,
        usaIva: empresaGuardada.usaIva,
      },
      usuario: {
        _id: adminGuardado._id,
        nombre: adminGuardado.nombre,
        apellido: adminGuardado.apellido,
        correo: adminGuardado.correo,
        rol: adminGuardado.rol,
      },
    });
  } catch (error) {
    console.error('Error al registrar empresa:', error);
    res.status(500).json({ mensaje: 'Error al registrar la empresa' });
  }
};

/**
 * Devuelve la empresa del usuario autenticado.
 */
const obtenerMiEmpresa = async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.empresaId);
    if (!empresa) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }
    res.json(empresa);
  } catch (error) {
    console.error('Error al obtener la empresa:', error);
    res.status(500).json({ mensaje: 'Error al obtener la empresa' });
  }
};

/**
 * Actualiza la empresa del usuario autenticado.
 *
 * Solo se permiten campos de perfil. 'activa' y 'pagoRealizado' quedan
 * fuera a proposito: si un administrador pudiera activarse a si mismo (o
 * marcarse como pagado) se anularia el control de acceso por suscripcion.
 */
const actualizarMiEmpresa = async (req, res) => {
  try {
    const { nombre, razonSocial, usaIva } = req.body;

    const datos = {};
    if (nombre !== undefined) datos.nombre = String(nombre).trim();
    if (razonSocial !== undefined) datos.razonSocial = String(razonSocial).trim();
    if (usaIva !== undefined) datos.usaIva = Boolean(usaIva);

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    if (datos.nombre) {
      const repetida = await Empresa.findOne({
        _id: { $ne: req.empresaId },
        nombre: datos.nombre,
      });
      if (repetida) {
        return res.status(400).json({ mensaje: 'Ya existe una empresa con ese nombre' });
      }
    }

    const empresa = await Empresa.findByIdAndUpdate(req.empresaId, datos, { new: true });
    if (!empresa) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    res.json({ mensaje: 'Empresa actualizada', empresa });
  } catch (error) {
    console.error('Error al actualizar la empresa:', error);
    res.status(500).json({ mensaje: 'Error al actualizar la empresa' });
  }
};

/**
 * Elimina la empresa del usuario autenticado y todos sus datos relacionados.
 *
 * Es una operacion destructiva e irreversible, por eso exige confirmar la
 * contrasena del administrador que la ejecuta.
 */
const eliminarMiEmpresa = async (req, res) => {
  try {
    const { confirmarContraseña } = req.body;

    if (!confirmarContraseña) {
      return res.status(400).json({
        mensaje: 'Debes confirmar tu contraseña para eliminar la empresa',
      });
    }

    const admin = await Usuario.findById(req.usuario._id);
    const contraseñaCorrecta = await bcrypt.compare(confirmarContraseña, admin.contraseña);
    if (!contraseñaCorrecta) {
      return res.status(401).json({ mensaje: 'Contraseña de administrador incorrecta' });
    }

    // Cascada: se borra todo lo que pertenece a la empresa.
    // Se hace de forma SECUENCIAL (no con Promise.all) para no abrir seis
    // conexiones simultaneas al servidor de base de datos: con clusters
    // fragmentados eso puede agotar el pool y dejar la operacion a medias.
    await Usuario.deleteMany({ empresa: req.empresaId });
    await Plato.deleteMany({ empresa: req.empresaId });
    await Comanda.deleteMany({ empresa: req.empresaId });
    await Producto.deleteMany({ empresa: req.empresaId });
    await Ingrediente.deleteMany({ empresa: req.empresaId });
    await Mesa.deleteMany({ empresa: req.empresaId });

    const empresa = await Empresa.findByIdAndDelete(req.empresaId);
    if (!empresa) {
      return res.status(404).json({ mensaje: 'Empresa no encontrada' });
    }

    res.json({ mensaje: 'Empresa y datos relacionados eliminados con éxito' });
  } catch (error) {
    console.error('Error al eliminar la empresa:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la empresa' });
  }
};

module.exports = {
  registrarEmpresaConAdmin,
  obtenerMiEmpresa,
  actualizarMiEmpresa,
  eliminarMiEmpresa,
};
