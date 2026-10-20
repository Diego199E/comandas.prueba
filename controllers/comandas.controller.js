// controllers/comandas.controller.js
const Comanda = require('../models/comanda.model');
const Empresa = require('../models/empresa.model');
const Producto = require('../models/producto.model');
const mongoose = require('mongoose');
const {
  descontarIngredientesComanda,
  revertirEnSession,
} = require('./inventario.controller');

const { filtroEmpresa, empresaIdDe } = require('../utils/scope');
const { soloCampos } = require('../utils/campos');

// Comanda: que campos puede escribir el cliente. 'empresa', '_id', 'estado' e
// 'impresa' quedan FUERA a proposito: son de control del servidor.
const CAMPOS_COMANDA = ['mesa', 'platillos'];

/**
 * Resuelve los nombres de producto elegidos en cada platillo a sus ids
 * reales de Producto.
 *
 * Se hace al crear y al editar la comanda, para que el descuento de
 * inventario no dependa del texto: si despues se renombra un producto, la
 * comanda sigue apuntando al producto correcto.
 *
 * @returns {Promise<Array>} platillos con el campo productosResueltos
 */
async function resolverProductos(platillos, empresaId) {
  const nombres = new Set();
  for (const platillo of platillos) {
    for (const nombre of platillo.productos || []) nombres.add(nombre);
  }

  if (nombres.size === 0) {
    return platillos.map((p) => ({ ...p, productosResueltos: [] }));
  }

  const productos = await Producto.find({ empresa: empresaId, nombre: { $in: [...nombres] } })
    .select('_id nombre');

  const porNombre = new Map(productos.map((p) => [p.nombre, p._id]));

  return platillos.map((platillo) => ({
    ...platillo,
    productosResueltos: (platillo.productos || [])
      .filter((nombre) => porNombre.has(nombre))
      .map((nombre) => ({ nombre, producto: porNombre.get(nombre) })),
  }));
}

/**
 * Quita del payload los campos que un rol no debe ver.
 * La cocina necesita saber QUE pidio el cliente, no CUANTO costó.
 */
function ocultarPreciosParaCocina(comanda, rol) {
  if (rol !== 'Cocina') return comanda;

  // OJO: no se puede hacer {...comanda}. Los campos del schema de Mongoose
  // viven en el prototipo, asi que el spread solo copia las propiedades
  // internas del documento ($__, _doc, ...) y la respuesta llegaria vacia.
  // Hay que pasar primero por toObject().
  const objeto = comanda.toObject ? comanda.toObject() : { ...comanda };

  delete objeto.usaIva;
  objeto.platillos = (objeto.platillos || []).map((p) => {
    const platillo = { ...p };
    delete platillo.precio;
    return platillo;
  });

  return objeto;
}

/**
 * Valida la forma basica de una comanda antes de guardarla.
 * @returns {string|null} mensaje de error, o null si esta bien
 */
function validarComanda({ mesa, platillos }) {
  if (!mesa || typeof mesa !== 'string' || !mesa.trim()) {
    return 'La mesa es obligatoria';
  }

  if (!Array.isArray(platillos) || platillos.length === 0) {
    return 'La comanda debe tener al menos un platillo';
  }

  for (const p of platillos) {
    if (!p || !p.nombre) {
      return 'Cada platillo debe tener nombre';
    }
    if (typeof p.precio !== 'number' || Number.isNaN(p.precio)) {
      return `El precio del platillo "${p.nombre}" no es valido`;
    }
    if (p.productos !== undefined && !Array.isArray(p.productos)) {
      return `Los productos del platillo "${p.nombre}" no son validos`;
    }
  }

  return null;
}

// Obtener comandas solo de la empresa del usuario y no completadas
const getComandas = async (req, res) => {
  try {
    const comandas = await Comanda.find(filtroEmpresa(req)).populate('usuario', 'nombre');

    // A la cocina se le ocultan los precios: solo necesita el QUE, no el CUANTO.
    const resultado = comandas.map((c) => ocultarPreciosParaCocina(c, req.usuario.rol));

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener comandas:', error);
    res.status(500).json({ mensaje: 'Error al obtener comandas' });
  }
};

const crearComanda = async (req, res) => {
  try {
    const { mesa, platillos } = soloCampos(req.body, CAMPOS_COMANDA);

    const errorValidacion = validarComanda({ mesa, platillos });
    if (errorValidacion) {
      return res.status(400).json({ mensaje: errorValidacion });
    }

    const empresa = await Empresa.findById(empresaIdDe(req));
    if (!empresa) {
      return res.status(400).json({ mensaje: 'Empresa no encontrada' });
    }

    const platillosResueltos = await resolverProductos(platillos, empresaIdDe(req));

    const nuevaComanda = new Comanda({
      mesa: mesa.trim(),
      platillos: platillosResueltos,
      empresa: empresaIdDe(req),
      nitEmpresa: empresa.nit || '',
      razonSocialEmpresa: empresa.razonSocial || '',
      usuario: req.usuario._id, // ← esto permite luego usar populate("usuario")
      usaIva: empresa.usaIva || false,
    });

    await nuevaComanda.save();
    res.status(201).json(nuevaComanda);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear comanda' });
  }
};

const editarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { platillos } = soloCampos(req.body, ['platillos']);

    if (!Array.isArray(platillos) || platillos.length === 0) {
      return res.status(400).json({ mensaje: 'La comanda debe tener al menos un platillo' });
    }

    // El filtro por empresa garantiza que no se edite una comanda de otra empresa.
    const comanda = await Comanda.findOne(filtroEmpresa(req, { _id: id }));

    if (!comanda) {
      return res.status(404).json({ mensaje: 'Comanda no encontrada' });
    }

    comanda.platillos = await resolverProductos(platillos, empresaIdDe(req));
    await comanda.save();

    res.json({ mensaje: '✅ Comanda actualizada con éxito', comanda });
  } catch (error) {
    console.error('❌ Error al editar comanda:', error);
    res.status(500).json({ mensaje: 'Error al editar comanda' });
  }
};

const completarComanda = async (req, res) => {
  try {
    const { id } = req.params;

    // Transicion ATOMICA e idempotente: estado -> true.
    // Solo la peticion que logra la transicion sigue adelante; las demas
    // detectan que la comanda ya estaba completada.
    //
    // OJO: el filtro usa {estado: {$ne: true}} y no {estado: false} porque
    // en MongoDB {campo: false} NO matchea un documento al que le falta el
    // campo, y las comandas viejas podrian no tenerlo.
    const comanda = await Comanda.findOneAndUpdate(
      filtroEmpresa(req, { _id: id, estado: { $ne: true } }),
      { $set: { estado: true } },
      { new: true }
    );

    if (!comanda) {
      const existente = await Comanda.findOne(filtroEmpresa(req, { _id: id }));
      if (!existente) {
        return res.status(404).json({ mensaje: 'Comanda no encontrada' });
      }

      // Ya estaba completada. Se vuelve a intentar el descuento (que es
      // idempotente) por si la vez anterior fallo a mitad de camino y el
      // stock quedo sin descontar.
      const stock = await descontarIngredientesComanda(existente._id);
      const actualizada = await Comanda.findById(existente._id);

      return res.json({
        mensaje: 'La comanda ya estaba completada',
        comanda: actualizada,
        stock,
      });
    }

    // Descuento de inventario. Es idempotente: se aplica como maximo una vez
    // por comanda, aunque se llame muchas veces.
    const stock = await descontarIngredientesComanda(comanda._id);
    const actualizada = await Comanda.findById(comanda._id);

    res.json({
      mensaje: 'Comanda marcada como completada',
      comanda: actualizada,
      stock,
    });
  } catch (error) {
    console.error('Error al completar comanda:', error);
    res.status(500).json({ mensaje: 'Error al completar comanda' });
  }
};

const eliminarComanda = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await mongoose.startSession();
    let comandaEliminada = null;
    let stock = null;

    try {
      await session.withTransaction(async () => {
        const comanda = await Comanda.findOne(filtroEmpresa(req, { _id: id })).session(session);
        if (!comanda) return;

        // Si el stock ya se habia descontado, se devuelve al inventario. Va en
        // la MISMA transaccion que el borrado (MongoDB no permite anidar
        // transacciones) para que no quede stock devuelto sin comanda
        // borrada, ni comanda borrada sin devolver el stock.
        if (comanda.stockDescontado) {
          stock = await revertirEnSession(session, id);
        }

        comandaEliminada = await Comanda.findOneAndDelete(filtroEmpresa(req, { _id: id })).session(session);
      });
    } finally {
      await session.endSession();
    }

    if (!comandaEliminada) {
      return res.status(404).json({ mensaje: 'Comanda no encontrada' });
    }

    res.json({
      mensaje: '✅ Comanda eliminada con éxito',
      stockRevertido: stock?.revertido || false,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: '❌ Error al eliminar comanda' });
  }
};

// Borra todas las comandas de la empresa actual
const eliminarTodasLasComandas = async (req, res) => {
  try {
    await Comanda.deleteMany(filtroEmpresa(req));
    res.json({ mensaje: 'Todas las comandas fueron eliminadas correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar todas las comandas:', error);
    res.status(500).json({ mensaje: 'Error al eliminar todas las comandas' });
  }
};

//para imprimir desde app y marcar una comanda como impresa
const marcarComoImpresa = async (req, res) => {
  try {
    const comandaId = req.params.id;

    const comanda = await Comanda.findOneAndUpdate(
      filtroEmpresa(req, { _id: comandaId }),
      { impresa: true },
      { new: true }
    );

    if (!comanda) {
      return res.status(404).json({ mensaje: 'Comanda no encontrada o no pertenece a tu empresa' });
    }

    res.json({ mensaje: '✅ Comanda marcada como impresa', comanda });
  } catch (error) {
    console.error('❌ Error al marcar como impresa:', error);
    res.status(500).json({ mensaje: 'Error al marcar la comanda como impresa' });
  }
};

module.exports = {
  getComandas,
  crearComanda,
  editarComanda,
  completarComanda,
  eliminarComanda,
  eliminarTodasLasComandas,
  marcarComoImpresa,
};
