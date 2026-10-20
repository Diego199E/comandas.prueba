// test/mesas.test.js
// Mesas persistentes: el borrador del pedido sobrevive a una recarga y la
// mesa queda asociada a la comanda enviada.
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
let tokenMesero;

before(async () => {
  servidor = await iniciarServidor();
  base = servidor.base;
  ctx = await crearEmpresaDePrueba(base, Date.now());
  tokenMesero = await crearUsuarioDePrueba(base, ctx, 'Mesero', Date.now());
});

after(async () => {
  await eliminarEmpresaDePrueba(base, ctx);
  await servidor.detener();
});

describe('Crear y listar mesas', () => {
  test('El mesero puede crear una mesa', async () => {
    const res = await req(base, 'POST', '/api/mesas', {
      token: tokenMesero,
      body: { nombre: 'Mesa 1' },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.nombre, 'Mesa 1');
    assert.equal(res.data.estado, 'Libre');
    assert.deepEqual(res.data.platillos, []);
  });

  test('No se puede crear una mesa con el mismo nombre', async () => {
    const res = await req(base, 'POST', '/api/mesas', {
      token: tokenMesero,
      body: { nombre: 'Mesa 1' },
    });

    assert.equal(res.status, 409);
  });

  test('Una mesa necesita nombre', async () => {
    const res = await req(base, 'POST', '/api/mesas', { token: tokenMesero, body: {} });
    assert.equal(res.status, 400);
  });

  test('La lista de mesas solo trae las de su empresa', async () => {
    const otra = await crearEmpresaDePrueba(base, Date.now() + 1);
    await req(base, 'POST', '/api/mesas', { token: otra.token, body: { nombre: 'Mesa 99' } });

    const res = await req(base, 'GET', '/api/mesas', { token: tokenMesero });
    const nombres = res.data.map((m) => m.nombre);

    assert.ok(nombres.includes('Mesa 1'));
    assert.ok(!nombres.includes('Mesa 99'), 'Sefiltration una mesa de otra empresa');

    await eliminarEmpresaDePrueba(base, otra);
  });

  test('Sin token responde 401', async () => {
    const res = await req(base, 'GET', '/api/mesas');
    assert.equal(res.status, 401);
  });

  test('La cocina no puede ver las mesas', async () => {
    const tokenCocina = await crearUsuarioDePrueba(base, ctx, 'Cocina', Date.now() + 2);
    const res = await req(base, 'GET', '/api/mesas', { token: tokenCocina });
    assert.equal(res.status, 403);
  });
});

describe('El borrador de la mesa', () => {
  test('Se guardan los platillos del pedido en curso', async () => {
    const mesa = (await req(base, 'POST', '/api/mesas', { token: tokenMesero, body: { nombre: 'Mesa 2' } })).data;

    const res = await req(base, 'PUT', `/api/mesas/${mesa._id}`, {
      token: tokenMesero,
      body: {
        platillos: [
          { nombre: 'Desayuno', precio: 18000, opciones: { Principal: 'Pan' } },
        ],
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.platillos.length, 1);
    assert.equal(res.data.platillos[0].nombre, 'Desayuno');
    assert.equal(res.data.platillos[0].precio, 18000);
  });

  test('El borrador sobrevive a releer la mesa (como una recarga del navegador)', async () => {
    const mesas = (await req(base, 'GET', '/api/mesas', { token: tokenMesero })).data;
    const mesa = mesas.find((m) => m.nombre === 'Mesa 2');

    assert.ok(mesa, 'No se encontro la Mesa 2');
    assert.equal(mesa.platillos.length, 1);
    assert.equal(mesa.platillos[0].opciones.Principal, 'Pan');
  });

  test('No se puede escribir "empresa" ni "comandaActual" desde el body', async () => {
    const mesas = (await req(base, 'GET', '/api/mesas', { token: tokenMesero })).data;
    const mesa = mesas.find((m) => m.nombre === 'Mesa 2');

    const res = await req(base, 'PUT', `/api/mesas/${mesa._id}`, {
      token: tokenMesero,
      body: { estado: 'Ocupada', empresa: '000000000000000000000000' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.empresa, ctx.empresa._id);
  });

  test('Un estado invalido responde 400', async () => {
    const mesas = (await req(base, 'GET', '/api/mesas', { token: tokenMesero })).data;
    const mesa = mesas.find((m) => m.nombre === 'Mesa 2');

    const res = await req(base, 'PUT', `/api/mesas/${mesa._id}`, {
      token: tokenMesero,
      body: { estado: 'Inventada' },
    });

    assert.equal(res.status, 400);
  });
});

describe('Enviar el pedido', () => {
  test('La mesa queda ocupada, con la comanda asociada y sin borrador', async () => {
    const mesa = (await req(base, 'POST', '/api/mesas', { token: tokenMesero, body: { nombre: 'Mesa 3' } })).data;

    await req(base, 'PUT', `/api/mesas/${mesa._id}`, {
      token: tokenMesero,
      body: { platillos: [{ nombre: 'Desayuno', precio: 18000, opciones: { Principal: 'Pan' } }] },
    });

    const comanda = (
      await req(base, 'POST', '/api/comandas', {
        token: tokenMesero,
        body: {
          mesa: 'Mesa 3',
          platillos: [{ nombre: 'Desayuno', precio: 18000, productos: ['Pan'] }],
        },
      })
    ).data;

    const mesas = (await req(base, 'GET', '/api/mesas', { token: tokenMesero })).data;
    const actualizada = mesas.find((m) => m.nombre === 'Mesa 3');

    assert.equal(actualizada.estado, 'Ocupada');
    assert.equal(actualizada.comandaActual, comanda._id);
    assert.equal(actualizada.platillos.length, 0, 'El borrador no se limpio');
  });
});

describe('Liberar y eliminar mesas', () => {
  test('Liberar la mesa la deja libre y limpia su comanda', async () => {
    const mesa = (await req(base, 'POST', '/api/mesas', { token: tokenMesero, body: { nombre: 'Mesa 4' } })).data;

    await req(base, 'POST', '/api/comandas', {
      token: tokenMesero,
      body: { mesa: 'Mesa 4', platillos: [{ nombre: 'X', precio: 1, productos: [] }] },
    });

    const res = await req(base, 'PUT', `/api/mesas/${mesa._id}`, {
      token: tokenMesero,
      body: { estado: 'Libre' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.estado, 'Libre');
    assert.equal(res.data.comandaActual, null);
  });

  test('Un mesero no puede borrar una mesa con pedido en curso', async () => {
    const mesa = (await req(base, 'POST', '/api/mesas', { token: tokenMesero, body: { nombre: 'Mesa 5' } })).data;

    await req(base, 'PUT', `/api/mesas/${mesa._id}`, {
      token: tokenMesero,
      body: { platillos: [{ nombre: 'X', precio: 1, opciones: {} }] },
    });

    const res = await req(base, 'DELETE', `/api/mesas/${mesa._id}`, { token: tokenMesero });
    assert.equal(res.status, 409);
  });

  test('Un mesero si puede borrar una mesa libre y vacia', async () => {
    const mesa = (await req(base, 'POST', '/api/mesas', { token: tokenMesero, body: { nombre: 'Mesa 6' } })).data;

    const res = await req(base, 'DELETE', `/api/mesas/${mesa._id}`, { token: tokenMesero });
    assert.equal(res.status, 200);

    const mesas = (await req(base, 'GET', '/api/mesas', { token: tokenMesero })).data;
    assert.ok(!mesas.some((m) => m.nombre === 'Mesa 6'));
  });

  test('No se puede tocar una mesa de otra empresa', async () => {
    const otra = await crearEmpresaDePrueba(base, Date.now() + 3);
    const mesaAjena = (await req(base, 'POST', '/api/mesas', { token: otra.token, body: { nombre: 'Mesa 1' } })).data;

    const res = await req(base, 'DELETE', `/api/mesas/${mesaAjena._id}`, { token: tokenMesero });
    assert.equal(res.status, 404);

    await eliminarEmpresaDePrueba(base, otra);
  });
});
