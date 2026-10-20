// test/cocina.test.js
// Vista de cocina: consulta de pendientes, estado de preparacion y permisos.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  iniciarServidor,
  req,
  crearEmpresaDePrueba,
  eliminarEmpresaDePrueba,
  crearUsuarioDePrueba,
} = require('./helpers');

let ctx;
let base;
let servidor;
let tokenCocina;
let comandaPendiente;
let comandaServida;

before(async () => {
  servidor = await iniciarServidor();
  base = servidor.base;
  ctx = await crearEmpresaDePrueba(base, Date.now());

  tokenCocina = await crearUsuarioDePrueba(base, ctx, 'Cocina', Date.now());

  comandaPendiente = (
    await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: {
        mesa: 'Mesa 1',
        platillos: [{ nombre: 'Desayuno', precio: 20000, productos: ['Pan'] }],
      },
    })
  ).data;

  comandaServida = (
    await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: {
        mesa: 'Mesa 2',
        platillos: [{ nombre: 'Almuerzo', precio: 30000, productos: ['Arroz'] }],
      },
    })
  ).data;

  await req(base, 'PATCH', `/api/comandas/${comandaServida._id}`, { token: ctx.token });
});

after(async () => {
  await eliminarEmpresaDePrueba(base, ctx);
  await servidor.detener();
});

describe('Consulta de pedidos pendientes', () => {
  test('?pendientes=true devuelve solo las comandas no servidas', async () => {
    const res = await req(base, 'GET', '/api/comandas?pendientes=true', { token: ctx.token });

    assert.equal(res.status, 200);
    const ids = res.data.map((c) => c._id);
    assert.ok(ids.includes(comandaPendiente._id), 'Falta la comanda pendiente');
    assert.ok(!ids.includes(comandaServida._id), 'Trae una comanda ya servida');
  });

  test('Sin el parametro devuelve todas las comandas', async () => {
    const res = await req(base, 'GET', '/api/comandas', { token: ctx.token });

    const ids = res.data.map((c) => c._id);
    assert.ok(ids.includes(comandaPendiente._id));
    assert.ok(ids.includes(comandaServida._id));
  });
});

describe('Estado de preparacion', () => {
  test('La comanda nace en estado Pendiente', async () => {
    const res = await req(base, 'GET', '/api/comandas', { token: ctx.token });
    const comanda = res.data.find((c) => c._id === comandaPendiente._id);
    assert.equal(comanda.estadoCocina, 'Pendiente');
  });

  test('La cocina puede mover el pedido a "En preparacion"', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${comandaPendiente._id}/preparacion`, {
      token: tokenCocina,
      body: { estadoCocina: 'En preparacion' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.comanda.estadoCocina, 'En preparacion');
  });

  test('La cocina puede mover el pedido a "Listo"', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${comandaPendiente._id}/preparacion`, {
      token: tokenCocina,
      body: { estadoCocina: 'Listo' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.comanda.estadoCocina, 'Listo');
  });

  test('Un estado invalido responde 400', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${comandaPendiente._id}/preparacion`, {
      token: tokenCocina,
      body: { estadoCocina: 'Inventado' },
    });

    assert.equal(res.status, 400);
  });

  test('No se puede cambiar el estado de una comanda de otra empresa', async () => {
    const otra = await crearEmpresaDePrueba(base, Date.now() + 1);
    const comandaAjena = (
      await req(base, 'POST', '/api/comandas', {
        token: otra.token,
        body: { mesa: 'M9', platillos: [{ nombre: 'X', precio: 1, productos: [] }] },
      })
    ).data;

    const res = await req(base, 'PATCH', `/api/comandas/${comandaAjena._id}/preparacion`, {
      token: ctx.token,
      body: { estadoCocina: 'Listo' },
    });

    assert.equal(res.status, 404);
    await eliminarEmpresaDePrueba(base, otra);
  });

  test('Sin token responde 401', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${comandaPendiente._id}/preparacion`, {
      body: { estadoCocina: 'Listo' },
    });

    assert.equal(res.status, 401);
  });
});

describe('Lo que la cocina ve', () => {
  test('No recibe los precios de los platillos', async () => {
    const res = await req(base, 'GET', '/api/comandas?pendientes=true', { token: tokenCocina });

    const comanda = res.data.find((c) => c._id === comandaPendiente._id);
    assert.ok(comanda, 'La cocina no recibio la comanda');
    for (const platillo of comanda.platillos) {
      assert.equal(platillo.precio, undefined, 'La cocina ve el precio');
    }
  });

  test('Marca el pedido como servido y sale de la pantalla', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${comandaPendiente._id}`, {
      token: tokenCocina,
    });

    assert.equal(res.status, 200);

    const pendientes = await req(base, 'GET', '/api/comandas?pendientes=true', { token: tokenCocina });
    assert.ok(
      !pendientes.data.some((c) => c._id === comandaPendiente._id),
      'El pedido servido sigue apareciendo en cocina'
    );
  });
});
