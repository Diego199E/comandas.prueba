// test/inventario.test.js
// Descuento de inventario idempotente (ver DOCUMENTO-DESCUENTO-INVENTARIO.md).
//
// El stock se descuenta al ENVIAR el pedido (reserva), no al servirlo: entre
// que el pedido entra a cocina y que se sirve, ese stock ya no esta disponible
// para otra mesa.
//
// AISLAMIENTO: cada bloque describe() crea SU PROPIO juego de ingredientes,
// productos y platos (con nombres unicos). Compartir un mismo ingrediente
// entre bloques hace que las pruebas dependan del orden y fallen de forma
// intermitente.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  iniciarServidor,
  req,
  crearEmpresaDePrueba,
  eliminarEmpresaDePrueba,
} = require('./helpers');

let ctx;
let base;
let servidor;

before(async () => {
  servidor = await iniciarServidor();
  base = servidor.base;
  ctx = await crearEmpresaDePrueba(base, Date.now());
});

after(async () => {
  await eliminarEmpresaDePrueba(base, ctx);
  await servidor.detener();
});

/**
 * Crea un juego de datos aislado: dos ingredientes ("Harina X", "Azucar X"),
 * dos productos ("Pan X" usa 10+2, "Bizcocho X" usa 5) y un plato "Desayuno X".
 * Con combo=true agrega ademas el plato "Combo X" con los dos componentes.
 */
async function crearKit(sufijo, { combo = false } = {}) {
  const token = ctx.token;

  const harina = `Harina ${sufijo}`;
  const azucar = `Azucar ${sufijo}`;
  const pan = `Pan ${sufijo}`;
  const bizcocho = `Bizcocho ${sufijo}`;
  const desayuno = `Desayuno ${sufijo}`;

  const ing = (
    await req(base, 'POST', '/api/ingredientes', {
      token,
      body: { nombre: harina, cantidad: 100, unidad: 'kg' },
    })
  ).data;

  const ing2 = (
    await req(base, 'POST', '/api/ingredientes', {
      token,
      body: { nombre: azucar, cantidad: 50, unidad: 'kg' },
    })
  ).data;

  await req(base, 'POST', '/api/productos', {
    token,
    body: {
      nombre: pan,
      ingredientesUsados: [
        { ingrediente: ing._id, cantidadUsada: 10 },
        { ingrediente: ing2._id, cantidadUsada: 2 },
      ],
    },
  });

  await req(base, 'POST', '/api/productos', {
    token,
    body: {
      nombre: bizcocho,
      ingredientesUsados: [{ ingrediente: ing._id, cantidadUsada: 5 }],
    },
  });

  await req(base, 'POST', '/api/platos', {
    token,
    body: { nombre: desayuno, precio: 100, contenido: [{ categoria: 'Principal', valor: pan }] },
  });

  if (combo) {
    await req(base, 'POST', '/api/platos', {
      token,
      body: {
        nombre: `Combo ${sufijo}`,
        precio: 200,
        contenido: [
          { categoria: 'Principal', valor: pan },
          { categoria: 'Acompanamiento', valor: bizcocho },
        ],
      },
    });
  }

  return { harina, azucar, pan, bizcocho, desayuno };
}

const stockDe = async (nombre) => {
  const res = await req(base, 'GET', '/api/ingredientes', { token: ctx.token });
  const encontrado = res.data.find((i) => i.nombre === nombre);
  return encontrado ? encontrado.cantidad : null;
};

/** Crea una comanda (y con ella reserva el stock). */
const crearComanda = async (kit, mesa, productos, plato) =>
  (
    await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: { mesa, platillos: [{ nombre: plato || kit.desayuno, precio: 100, productos }] },
    })
  ).data;

describe('Reserva al enviar el pedido', () => {
  let kit;

  before(async () => {
    kit = await crearKit('reserva');
  });

  test('Crear la comanda ya descuenta el stock', async () => {
    const antesHarina = await stockDe(kit.harina);
    const antesAzucar = await stockDe(kit.azucar);

    await crearComanda(kit, 'M1', [kit.pan]);

    assert.equal(await stockDe(kit.harina), antesHarina - 10);
    assert.equal(await stockDe(kit.azucar), antesAzucar - 2);
  });

  test('El stock queda reservado mientras la comanda NO esta servida', async () => {
    const comandas = await req(base, 'GET', '/api/comandas?pendientes=true', { token: ctx.token });
    const pendiente = comandas.data.find((c) => c.estado === false);

    assert.ok(pendiente, 'No hay comandas pendientes');
    assert.equal(pendiente.stockDescontado, true, 'La comanda no tiene el stock reservado');
  });

  test('Marcar la comanda como servida NO vuelve a descontar', async () => {
    const antes = await stockDe(kit.harina);
    const comanda = await crearComanda(kit, 'M2', [kit.pan]);

    assert.equal(await stockDe(kit.harina), antes - 10);

    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(await stockDe(kit.harina), antes - 10, 'El servirse descontó otra vez');
  });

  test('Completar 5 veces la misma comanda no descuenta mas', async () => {
    const antes = await stockDe(kit.harina);
    const comanda = await crearComanda(kit, 'M3', [kit.pan]);

    for (let i = 0; i < 5; i++) {
      await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });
    }

    assert.equal(await stockDe(kit.harina), antes - 10);
  });

  test('La segunda respuesta de completar indica que ya estaba descontado', async () => {
    const comanda = await crearComanda(kit, 'M3b', [kit.pan]);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });
    const segunda = await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(segunda.data.stock.yaDescontado, true);
    assert.equal(segunda.data.stock.aplicado, false);
  });

  test('Dos comandas distintas reservan el stock por separado', async () => {
    const antes = await stockDe(kit.harina);
    await crearComanda(kit, 'M4', [kit.pan]);
    await crearComanda(kit, 'M5', [kit.pan]);

    assert.equal(await stockDe(kit.harina), antes - 20);
  });

  test('Dos productos con el mismo ingrediente restan la suma', async () => {
    const antes = await stockDe(kit.harina);
    await crearComanda(kit, 'M6', [kit.pan, kit.bizcocho]);

    assert.equal(await stockDe(kit.harina), antes - 15);
  });
});

describe('Cancelar una comanda devuelve el stock', () => {
  let kit;

  before(async () => {
    kit = await crearKit('cancelar');
  });

  test('Borrar una comanda PENDIENTE devuelve el stock reservado', async () => {
    const antes = await stockDe(kit.harina);
    const comanda = await crearComanda(kit, 'M7', [kit.pan]);

    assert.equal(await stockDe(kit.harina), antes - 10);

    const res = await req(base, 'DELETE', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(res.status, 200);
    assert.equal(res.data.stockRevertido, true);
    assert.equal(await stockDe(kit.harina), antes, 'El stock no volvio tras cancelar');
  });

  test('Borrar una comanda ya servida tambien devuelve el stock', async () => {
    const antes = await stockDe(kit.harina);
    const comanda = await crearComanda(kit, 'M8', [kit.pan]);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    const res = await req(base, 'DELETE', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(res.status, 200);
    assert.equal(await stockDe(kit.harina), antes);
  });

  test('Borrar dos veces la misma comanda no devuelve el stock dos veces', async () => {
    const antes = await stockDe(kit.harina);
    const comanda = await crearComanda(kit, 'M9', [kit.pan]);

    await req(base, 'DELETE', `/api/comandas/${comanda._id}`, { token: ctx.token });
    const segunda = await req(base, 'DELETE', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(segunda.status, 404);
    assert.equal(await stockDe(kit.harina), antes);
  });
});

describe('El descuento usa el id del producto, no el nombre', () => {
  let kit;

  before(async () => {
    kit = await crearKit('renombre');
  });

  test('Renombrar el producto no rompe la reserva', async () => {
    const antes = await stockDe(kit.harina);
    const comanda = await crearComanda(kit, 'M10', [kit.pan]);

    // Se busca el producto por nombre para renombrarlo.
    const productos = await req(base, 'GET', '/api/productos', { token: ctx.token });
    const producto = productos.data.find((p) => p.nombre === kit.pan);

    await req(base, 'PUT', `/api/productos/${producto._id}`, {
      token: ctx.token,
      body: { nombre: `${kit.pan} Artesanal` },
    });

    // La comanda ya habia reservado el stock al crearse.
    assert.equal(await stockDe(kit.harina), antes - 10);

    await req(base, 'PUT', `/api/productos/${producto._id}`, {
      token: ctx.token,
      body: { nombre: kit.pan },
    });
  });
});

describe('Composicion por defecto de un plato', () => {
  let kit;

  before(async () => {
    kit = await crearKit('defecto', { combo: true });
  });

  test('Un plato sin opciones se prepara como esta disenado y se descuenta', async () => {
    const antes = await stockDe(kit.harina);

    // Se envia el plato SIN productos: el sistema debe asumir su composicion
    // (Pan) y descontarlo.
    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: { mesa: 'D1', platillos: [{ nombre: kit.desayuno, precio: 100, productos: [] }] },
    });

    assert.equal(res.status, 201);
    assert.equal(await stockDe(kit.harina), antes - 10, 'No se descontó la composición por defecto');
    assert.deepEqual(res.data.platillos[0].productos, [kit.pan]);
    assert.equal(res.data.platillos[0].productoPorDefecto, true);
  });

  test('Un combo sin opciones descuenta TODOS sus componentes', async () => {
    const antes = await stockDe(kit.harina);

    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: {
        mesa: 'D2',
        platillos: [{ nombre: `Combo ${kit.desayuno.split(' ')[1]}`, precio: 200, productos: [] }],
      },
    });

    assert.equal(res.status, 201);
    // Pan (10) + Bizcocho (5) = 15
    assert.equal(await stockDe(kit.harina), antes - 15);
    assert.deepEqual(res.data.platillos[0].productos, [kit.pan, kit.bizcocho]);
  });

  test('Ya no se genera el aviso de "sin productos seleccionados"', async () => {
    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: { mesa: 'D3', platillos: [{ nombre: kit.desayuno, precio: 100, productos: [] }] },
    });

    const alertas = res.data.stock?.alertas || [];
    assert.ok(
      !alertas.some((a) => a.includes('sin productos seleccionados')),
      `Sigue apareciendo el aviso: ${JSON.stringify(alertas)}`
    );
  });

  test('Si el cliente eligio productos, gana su eleccion (no se aplica el defecto)', async () => {
    const antes = await stockDe(kit.harina);

    // Se pide el combo pero solo se elige "Pan": no se descuenta Bizcocho.
    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: {
        mesa: 'D4',
        platillos: [{ nombre: `Combo ${kit.desayuno.split(' ')[1]}`, precio: 200, productos: [kit.pan] }],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(await stockDe(kit.harina), antes - 10, 'Se descontó el combo completo');
    assert.equal(res.data.platillos[0].productoPorDefecto, false);
  });

  test('Un plato sin composion registrada no descuenta y deja aviso', async () => {
    const antes = await stockDe(kit.harina);

    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: {
        mesa: 'D5',
        platillos: [{ nombre: 'Plato Sin Receta', precio: 100, productos: [] }],
      },
    });

    assert.equal(res.status, 201);
    assert.equal(await stockDe(kit.harina), antes);
    assert.ok(
      (res.data.stock?.alertas || []).some((a) => a.includes('sin productos seleccionados')),
      'No se avisó que no hay composición'
    );
  });
});

describe('Avisos del proceso', () => {
  let kit;

  before(async () => {
    kit = await crearKit('avisos');
  });

  test('Un producto cuyo ingrediente fue borrado avisa y omite', async () => {
    const temporal = (
      await req(base, 'POST', '/api/ingredientes', {
        token: ctx.token,
        body: { nombre: `Temporal ${kit.harina}`, cantidad: 100, unidad: 'kg' },
      })
    ).data;

    await req(base, 'POST', '/api/productos', {
      token: ctx.token,
      body: {
        nombre: `Producto Huerfano ${kit.harina}`,
        ingredientesUsados: [{ ingrediente: temporal._id, cantidadUsada: 7 }],
      },
    });

    await req(base, 'DELETE', `/api/ingredientes/${temporal._id}`, { token: ctx.token });

    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: {
        mesa: 'A1',
        platillos: [
          {
            nombre: kit.desayuno,
            precio: 100,
            productos: [`Producto Huerfano ${kit.harina}`],
          },
        ],
      },
    });

    assert.equal(res.status, 201);
    assert.ok(
      (res.data.stock?.alertas || []).some((a) => a.includes('ya no existe')),
      'No se registro el aviso de ingrediente inexistente'
    );
  });

  test('El stock insuficiente deja el valor en negativo y avisa AL ENVIAR', async () => {
    const ingredientes = await req(base, 'GET', '/api/ingredientes', { token: ctx.token });
    const azucar = ingredientes.data.find((i) => i.nombre === kit.azucar);

    await req(base, 'PUT', `/api/ingredientes/${azucar._id}`, {
      token: ctx.token,
      body: { cantidad: 1 },
    });

    const res = await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: { mesa: 'A2', platillos: [{ nombre: kit.desayuno, precio: 100, productos: [kit.pan] }] },
    });

    assert.equal(res.status, 201);
    assert.ok((await stockDe(kit.azucar)) < 0, 'El stock deberia quedar en negativo');
    assert.ok(
      (res.data.stock?.alertas || []).some((a) => a.includes('negativo')),
      'No se registro el aviso de stock negativo'
    );
  });
});

describe('Trazabilidad', () => {
  let kit;

  before(async () => {
    kit = await crearKit('trazabilidad');
  });

  test('La comanda registra que ya se descontó el stock', async () => {
    const comanda = await crearComanda(kit, 'T1', [kit.pan]);

    const listado = await req(base, 'GET', '/api/comandas', { token: ctx.token });
    const guardada = listado.data.find((c) => c._id === comanda._id);

    assert.equal(guardada.stockDescontado, true);
    assert.ok(guardada.stockDescontadoEn, 'No se registro la fecha del descuento');
  });
});
