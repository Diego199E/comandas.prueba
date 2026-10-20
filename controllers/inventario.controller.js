// controllers/inventario.controller.js
// Descuento (y reversión) del inventario al completar una comanda.
//
// REQUISITO CENTRAL: el descuento se aplica EXACTAMENTE UNA VEZ por comanda,
// sin importar cuántas veces se llame a completarComanda (doble clic,
// reintento por timeout, polling, varias pestañas abiertas...).
//
// COMO SE GARANTIZA:
//   1. Reclamación atómica: dentro de una transacción se hace un
//      updateOne condicional {stockDescontado: {$ne: true}} -> {true}.
//      Si otra petición ya lo reclamó, modifiedCount es 0 y esta no toca
//      nada. El filtro usa $ne (y no == false) porque las comandas creadas
//      antes de existir el campo NO lo tienen, y {campo: false} en MongoDB
//      NO matchea un documento al que le falta el campo.
//   2. Todo el descuento ocurre dentro de esa misma transacción: o se aplica
//      todo (stock + marca de descontado), o no se aplica nada.
//   3. Si la transacción falla, la marca vuelve a su estado anterior: la
//      comanda queda completada pero SIN descontar, y un reintento puede
//      recuperar el descuento sin miedo de duplicarlo.
//
// El descuento se acumula por ingrediente antes de aplicarse: si tres
// productos usan el mismo ingrediente, se resta una sola vez la suma, en una
// sola operacion. Esto evita además que se pierdan actualizaciones por
// lectura-modificación-escritura concurrente.
const mongoose = require('mongoose');

const Comanda = require('../models/comanda.model');
const Producto = require('../models/producto.model');
const Ingrediente = require('../models/ingrediente.model');

/**
 * Carga los productos y los ingredientes que necesita una comanda.
 * Dos consultas como máximo, sin N+1.
 *
 * @returns {{productosPorId: Map, productosPorNombre: Map, ingredientesPorId: Map}}
 */
async function cargarDatos(comanda, session) {
  const ids = new Set();
  const nombres = new Set();

  for (const platillo of comanda.platillos || []) {
    const resueltos = platillo.productosResueltos || [];

    if (resueltos.length > 0) {
      resueltos.forEach((r) => ids.add(String(r.producto)));
    } else {
      // Comanda vieja (sin productosResueltos): se resuelve por nombre.
      (platillo.productos || []).forEach((n) => nombres.add(n));
    }
  }

  const consultas = [];
  if (ids.size > 0) {
    consultas.push(Producto.find({ empresa: comanda.empresa, _id: { $in: [...ids] } }).session(session));
  }
  if (nombres.size > 0) {
    consultas.push(Producto.find({ empresa: comanda.empresa, nombre: { $in: [...nombres] } }).session(session));
  }

  const productos = (await Promise.all(consultas)).flat();

  const idsIngrediente = new Set();
  for (const producto of productos) {
    for (const uso of producto.ingredientesUsados || []) {
      idsIngrediente.add(String(uso.ingrediente));
    }
  }

  const ingredientes = idsIngrediente.size
    ? await Ingrediente.find({ _id: { $in: [...idsIngrediente] } }).session(session)
    : [];

  return {
    productosPorId: new Map(productos.map((p) => [String(p._id), p])),
    productosPorNombre: new Map(productos.map((p) => [p.nombre, p])),
    ingredientesPorId: new Map(ingredientes.map((i) => [String(i._id), i])),
  };
}

/**
 * Resuelve, para cada platillo de la comanda, qué Producto es cada opcion
 * elegida por el cliente.
 *
 * Se resuelve por id (productoIds) porque es la referencia real y no se rompe
 * si el producto se renombra. Si no hay id, se cae al nombre.
 *
 * @returns {Array<{nombre: string, productosResueltos: Array<object|null>}>}
 */
function resolverPlatillos(comanda, productosPorId, productosPorNombre) {
  return (comanda.platillos || []).map((platillo) => {
    const resueltos = platillo.productosResueltos || [];
    const totalOpciones = (platillo.productos || []).length;

    if (resueltos.length > 0) {
      // Caso actual: referencia directa al Producto por id.
      return {
        nombre: platillo.nombre,
        totalOpciones,
        productosResueltos: resueltos.map((r) => productosPorId.get(String(r.producto)) || null),
      };
    }

    // Caso heredado: solo hay nombres.
    return {
      nombre: platillo.nombre,
      totalOpciones,
      productosResueltos: (platillo.productos || []).map((n) => productosPorNombre.get(n) || null),
    };
  });
}

/**
 * Calcula cuánto se debe restar de cada ingrediente, acumulando las
 * apariciones (un mismo producto pedido dos veces descuenta dos veces).
 *
 * @returns {{deduccion: Map<string, object>, alertas: string[]}}
 */
function calcularDeduccion(platillos, ingredientesPorId, empresaComanda) {
  const deduccion = new Map();
  const alertas = [];

  for (const platillo of platillos) {
    if (platillo.totalOpciones === 0) {
      // Se pidió el plato sin elegir ninguna opción: no hay forma de saber
      // qué se preparó, así que no se descuenta nada. Queda registrado para
      // que el administrador lo vea en vez de perderse en silencio.
      alertas.push(
        `El plato "${platillo.nombre}" se envió sin productos seleccionados: no se descontó stock`
      );
      continue;
    }

    const perdidos = platillo.totalOpciones - platillo.productosResueltos.filter(Boolean).length;
    if (perdidos > 0) {
      alertas.push(
        `En el plato "${platillo.nombre}" hay ${perdidos} opción(es) que no existen en el catálogo: no se descontaron`
      );
    }

    for (const producto of platillo.productosResueltos) {
      if (!producto) {
        alertas.push(
          `Hay un producto del plato "${platillo.nombre}" que no existe en el catálogo: no se descontó`
        );
        continue;
      }

      const usos = producto.ingredientesUsados || [];

      if (usos.length === 0) {
        alertas.push(`El producto "${producto.nombre}" no tiene receta: no se descontó stock`);
        continue;
      }

      for (const uso of usos) {
        const id = String(uso.ingrediente);
        const actual = ingredientesPorId.get(id);

        if (!actual) {
          alertas.push(
            `El producto "${producto.nombre}" referencia un ingrediente que ya no existe: se omitió`
          );
          continue;
        }

        if (empresaComanda && String(actual.empresa) !== String(empresaComanda)) {
          alertas.push(
            `El ingrediente "${actual.nombre}" pertenece a otra empresa: se omite por seguridad`
          );
          continue;
        }

        const entry = deduccion.get(id) || {
          id: actual._id,
          nombre: actual.nombre,
          unidad: actual.unidad,
          cantidad: 0,
          cantidadActual: actual.cantidad,
        };

        entry.cantidad += uso.cantidadUsada || 0;
        deduccion.set(id, entry);
      }
    }
  }

  // Avisos por stock insuficiente.
  for (const item of deduccion.values()) {
    const final = item.cantidadActual - item.cantidad;
    if (final < 0) {
      alertas.push(
        `"${item.nombre}" quedó en negativo (${item.cantidadActual} - ${item.cantidad} = ${final} ${item.unidad})`
      );
    }
  }

  return { deduccion, alertas };
}

/**
 * Aplica (o revierte) un movimiento de inventario sobre la comanda.
 *
 * @param {import('mongoose').ClientSession} session
 * @param {string} comandaId
 * @param {number} signo -1 para descontar (al reservar), +1 para revertir (al borrar)
 */
async function aplicarMovimiento(session, comandaId, signo) {
  const comanda = await Comanda.findOne({ _id: comandaId }).session(session);
  if (!comanda) return { ok: false, motivo: 'La comanda no existe' };

  // NOTA: aqui ya NO se exige que la comanda este "completada". El descuento
  // se aplica al ENVIAR el pedido (reserva de stock), cuando la comanda
  // todavia no fue servida. Lo que evita el doble descuento es la
  // reclamacion atomica de "stockDescontado", no el estado de la comanda.
  const { productosPorId, productosPorNombre, ingredientesPorId } = await cargarDatos(comanda, session);

  const platillos = resolverPlatillos(comanda, productosPorId, productosPorNombre);
  const { deduccion, alertas } = calcularDeduccion(platillos, ingredientesPorId, comanda.empresa);

  if (deduccion.size === 0) {
    return { ok: true, aplicado: false, alertas, detalle: [] };
  }

  // Un solo viaje de red para todos los ingredientes (bulkWrite con $inc).
  const operaciones = [...deduccion.values()].map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $inc: { cantidad: signo * item.cantidad } },
    },
  }));

  await Ingrediente.bulkWrite(operaciones, { session });

  const detalle = [...deduccion.values()].map((item) => ({
    nombre: item.nombre,
    unidad: item.unidad,
    cantidad: item.cantidad,
    // Cantidad que queda tras aplicar el movimiento.
    // signo = -1 (descontar): actual - cantidad.  signo = +1 (revertir): actual + cantidad.
    resultado: item.cantidadActual + signo * item.cantidad,
  }));

  return { ok: true, aplicado: true, alertas, detalle };
}

/**
 * Descuenta el inventario de una comanda. IDEMPOTENTE.
 *
 * @param {string} comandaId
 * @returns {Promise<{ok: boolean, yaDescontado?: boolean, aplicado?: boolean, alertas?: string[], detalle?: object[], error?: string}>}
 */
const descontarIngredientesComanda = async (comandaId) => {
  const session = await mongoose.startSession();

  try {
    let resultado;

    await session.withTransaction(async () => {
      // --- Reclamación atómica ---------------------------------------------
      // Solo una petición puede pasar de "sin descontar" a "descontado".
      const claim = await Comanda.updateOne(
        { _id: comandaId, stockDescontado: { $ne: true } },
        { $set: { stockDescontado: true, stockDescontadoEn: new Date() } },
        { session }
      );

      if (claim.modifiedCount === 0) {
        // Otra petición ya lo descontó: no se toca nada.
        resultado = {
          ok: true,
          yaDescontado: true,
          aplicado: false,
          alertas: [],
          detalle: [],
        };
        return;
      }

      const movimiento = await aplicarMovimiento(session, comandaId, -1);
      resultado = { ...movimiento, yaDescontado: false };

      // Se guardan los avisos (stock negativo, productos sin resolver, etc.)
      if (resultado.alertas && resultado.alertas.length > 0) {
        await Comanda.updateOne(
          { _id: comandaId },
          { $set: { alertasStock: resultado.alertas } },
          { session }
        );
      }
    });

    return resultado;
  } catch (error) {
    console.error('Error al descontar ingredientes:', error);
    // La transacción hizo rollback: stockDescontado sigue en false y el
    // descuento se puede reintentar sin duplicar.
    return {
      ok: false,
      yaDescontado: false,
      aplicado: false,
      alertas: [],
      detalle: [],
      error: error.message,
    };
  } finally {
    await session.endSession();
  }
};

/**
 * Revierte el descuento dentro de una transaccion YA ABIERTA.
 *
 * Se separa de revertirIngredientesComanda porque MongoDB no permite
 * anidar transacciones: al borrar una comanda, la devolucion del stock y el
 * borrado tienen que ocurrir en la MISMA transaccion.
 *
 * @param {import('mongoose').ClientSession} session
 * @param {string} comandaId
 */
const revertirEnSession = async (session, comandaId) => {
  const comanda = await Comanda.findOne({ _id: comandaId }).session(session);
  if (!comanda) {
    return { ok: false, revertido: false, motivo: 'La comanda no existe' };
  }

  if (!comanda.stockDescontado) {
    // Nunca se descontó: no hay nada que devolver.
    return { ok: true, revertido: false, detalle: [] };
  }

  const movimiento = await aplicarMovimiento(session, comandaId, +1);
  return { ...movimiento, revertido: movimiento.aplicado };
};

/**
 * Devuelve el stock al inventario al borrar una comanda ya descontada.
 * También idempotente: la comanda se borra dentro de la misma transacción,
 * así que no puede revertirse dos veces.
 *
 * @param {string} comandaId
 */
const revertirIngredientesComanda = async (comandaId) => {
  const session = await mongoose.startSession();

  try {
    let resultado;

    await session.withTransaction(async () => {
      resultado = await revertirEnSession(session, comandaId);
    });

    return resultado;
  } catch (error) {
    console.error('Error al revertir ingredientes:', error);
    return { ok: false, revertido: false, detalle: [], error: error.message };
  } finally {
    await session.endSession();
  }
};

module.exports = {
  descontarIngredientesComanda,
  revertirIngredientesComanda,
  revertirEnSession,
};
