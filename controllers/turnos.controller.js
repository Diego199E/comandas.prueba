// controllers/turnos.controller.js
// Turnos de trabajo: apertura, cierre y consulta.
//
// Regla central: solo puede haber UN turno abierto por empresa. Es la que
// permite saber a que turno pertenece cada comanda.
const Turno = require('../models/turno.model');
const Comanda = require('../models/comanda.model');

const { filtroEmpresa, empresaIdDe } = require('../utils/scope');
const { soloCampos } = require('../utils/campos');
const { calcularImpuestos } = require('../utils/impuestos');

/**
 * Lista los turnos de la empresa, del mas reciente al mas antiguo.
 * El turno abierto aparece primero.
 */
const obtenerTurnos = async (req, res) => {
  try {
    const turnos = await Turno.find(filtroEmpresa(req))
      .populate('abiertoPor', 'nombre')
      .populate('cerradoPor', 'nombre')
      .sort({ fecha: -1, createdAt: -1 });

    res.json(turnos);
  } catch (error) {
    console.error('Error al obtener los turnos:', error);
    res.status(500).json({ mensaje: 'Error al obtener los turnos' });
  }
};

/**
 * Detalle de un turno con sus comandas.
 */
const obtenerTurno = async (req, res) => {
  try {
    const turno = await Turno.findOne(filtroEmpresa(req, { _id: req.params.id }))
      .populate('abiertoPor', 'nombre')
      .populate('cerradoPor', 'nombre');

    if (!turno) {
      return res.status(404).json({ mensaje: 'Turno no encontrado' });
    }

    const comandas = await Comanda.find({ ...filtroEmpresa(req), turno: turno._id })
      .populate('usuario', 'nombre')
      .sort({ hora: 1 });

    res.json({ turno, comandas });
  } catch (error) {
    console.error('Error al obtener el turno:', error);
    res.status(500).json({ mensaje: 'Error al obtener el turno' });
  }
};

/**
 * Abre un turno nuevo.
 */
const abrirTurno = async (req, res) => {
  try {
    const { nombre, efectivoInicial } = soloCampos(req.body, ['nombre', 'efectivoInicial']);

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ mensaje: 'El nombre del turno es obligatorio' });
    }

    // Solo puede haber un turno abierto por empresa.
    const abierto = await Turno.findOne({
      empresa: empresaIdDe(req),
      estado: 'Abierto',
    });

    if (abierto) {
      return res.status(409).json({
        mensaje: `Ya hay un turno abierto ("${abierto.nombre}"). Ciérralo antes de abrir otro.`,
      });
    }

    const turno = await Turno.create({
      empresa: empresaIdDe(req),
      nombre: String(nombre).trim(),
      efectivoInicial: Number(efectivoInicial) || 0,
      estado: 'Abierto',
      abiertoPor: req.usuario._id,
      abiertoEn: new Date(),
    });

    res.status(201).json(turno);
  } catch (error) {
    console.error('Error al abrir el turno:', error);
    res.status(500).json({ mensaje: 'Error al abrir el turno' });
  }
};

/**
 * Cierra un turno y guarda la fotografia de sus ventas.
 */
const cerrarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const { efectivoFinal } = soloCampos(req.body, ['efectivoFinal']);

    const turno = await Turno.findOne(filtroEmpresa(req, { _id: id }));
    if (!turno) {
      return res.status(404).json({ mensaje: 'Turno no encontrado' });
    }

    if (turno.estado === 'Cerrado') {
      return res.status(409).json({ mensaje: 'El turno ya está cerrado' });
    }

    // Las comandas del turno.
    const comandas = await Comanda.find({ ...filtroEmpresa(req), turno: turno._id });
    const servidas = comandas.filter((c) => c.estado === true);

    const total = servidas.reduce(
      (acc, c) => acc + (c.platillos || []).reduce((a, p) => a + (p.precio || 0), 0),
      0
    );

    // El impuesto depende de la empresa (INC 8% por defecto en restaurantes).
    const empresa = req.usuario.empresa;
    const usaIva = empresa?.usaIva === true;
    const { base, impuesto } = calcularImpuestos(total, usaIva);

    turno.estado = 'Cerrado';
    turno.cerradoPor = req.usuario._id;
    turno.cerradoEn = new Date();
    turno.efectivoFinal = Number(efectivoFinal) || 0;
    turno.totales = {
      pedidos: comandas.length,
      pedidosServidos: servidas.length,
      subtotal: base,
      impuesto,
      total,
    };

    await turno.save();

    res.json({ mensaje: 'Turno cerrado', turno });
  } catch (error) {
    console.error('Error al cerrar el turno:', error);
    res.status(500).json({ mensaje: 'Error al cerrar el turno' });
  }
};

module.exports = {
  obtenerTurnos,
  obtenerTurno,
  abrirTurno,
  cerrarTurno,
};
