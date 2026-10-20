// controllers/mesas.controller.js
// Gestion de las mesas del restaurante.
//
// A diferencia del resto de modulos, el control de acceso es por ACCION y no
// solo por rol: un mesero puede tocar cualquier mesa de su empresa, pero
// solo puede borrar una mesa que este libre y sin pedido en curso.
const Mesa = require('../models/mesa.model');

const { filtroEmpresa, empresaIdDe } = require('../utils/scope');
const { soloCampos } = require('../utils/campos');

// Campos que el cliente puede escribir de una mesa.
// 'comandaActual' queda fuera: lo asigna el backend al enviar el pedido.
const CAMPOS_MESA = ['platillos', 'estado'];

const ESTADOS = ['Libre', 'Ocupada'];

/**
 * Lista las mesas de la empresa, ordenadas por nombre.
 */
const obtenerMesas = async (req, res) => {
  try {
    const mesas = await Mesa.find(filtroEmpresa(req)).sort({ nombre: 1 });
    res.json(mesas);
  } catch (error) {
    console.error('Error al obtener las mesas:', error);
    res.status(500).json({ mensaje: 'Error al obtener las mesas' });
  }
};

/**
 * Crea una mesa nueva.
 */
const crearMesa = async (req, res) => {
  try {
    const { nombre } = soloCampos(req.body, ['nombre']);

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ mensaje: 'El nombre de la mesa es obligatorio' });
    }

    const nombreLimpio = nombre.trim();

    const existente = await Mesa.findOne({
      empresa: empresaIdDe(req),
      nombre: nombreLimpio,
    });

    if (existente) {
      return res.status(409).json({ mensaje: `Ya existe la "${nombreLimpio}"` });
    }

    const mesa = await Mesa.create({
      nombre: nombreLimpio,
      empresa: empresaIdDe(req),
      estado: 'Libre',
    });

    res.status(201).json(mesa);
  } catch (error) {
    console.error('Error al crear la mesa:', error);
    res.status(500).json({ mensaje: 'Error al crear la mesa' });
  }
};

/**
 * Actualiza una mesa: el borrador del pedido o su estado.
 */
const actualizarMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = soloCampos(req.body, CAMPOS_MESA);

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    if (datos.estado !== undefined && !ESTADOS.includes(datos.estado)) {
      return res.status(400).json({
        mensaje: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}`,
      });
    }

    if (datos.platillos !== undefined) {
      if (!Array.isArray(datos.platillos)) {
        return res.status(400).json({ mensaje: 'Los platillos de la mesa no son válidos' });
      }

      datos.platillos = datos.platillos.map((platillo) => ({
        nombre: platillo.nombre,
        precio: Number(platillo.precio) || 0,
        opciones: platillo.opciones || {},
      }));
    }

    // Al liberar una mesa se limpian el borrador y la comanda asociada.
    if (datos.estado === 'Libre') {
      datos.platillos = [];
      datos.comandaActual = null;
    }

    const mesa = await Mesa.findOneAndUpdate(filtroEmpresa(req, { _id: id }), datos, {
      new: true,
    });

    if (!mesa) {
      return res.status(404).json({ mensaje: 'Mesa no encontrada' });
    }

    res.json(mesa);
  } catch (error) {
    console.error('Error al actualizar la mesa:', error);
    res.status(500).json({ mensaje: 'Error al actualizar la mesa' });
  }
};

/**
 * Elimina una mesa.
 *
 * Un mesero solo puede borrar una mesa libre y sin pedido en curso: si tiene
 * algo en ella, el pedido se perderia. Un administrador puede borrar cualquiera.
 */
const eliminarMesa = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await Mesa.findOne(filtroEmpresa(req, { _id: id }));
    if (!mesa) {
      return res.status(404).json({ mensaje: 'Mesa no encontrada' });
    }

    const esAdmin = req.usuario.rol === 'Admin';
    const tienePedido =
      (mesa.platillos && mesa.platillos.length > 0) || !!mesa.comandaActual;

    if (!esAdmin && tienePedido) {
      return res.status(409).json({
        mensaje: 'No se puede eliminar una mesa con un pedido en curso. Libera la mesa primero.',
      });
    }

    await Mesa.deleteOne({ _id: mesa._id });

    res.json({ mensaje: 'Mesa eliminada' });
  } catch (error) {
    console.error('Error al eliminar la mesa:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la mesa' });
  }
};

module.exports = {
  obtenerMesas,
  crearMesa,
  actualizarMesa,
  eliminarMesa,
};
