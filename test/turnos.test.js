// test/turnos.test.js
// Turnos de trabajo: apertura, cierre, pertenencia de las comandas y
// calculo de las ventas del turno.
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

const abrirTurno = async (nombre = 'Turno de prueba', efectivoInicial = 50000) =>
  (
    await req(base, 'POST', '/api/turnos', {
      token: ctx.token,
      body: { nombre, efectivoInicial },
    })
  ).data;

const crearComanda = async (precio = 10000, turnoAbierto = true) => {
  const res = await req(base, 'POST', '/api/comandas', {
    token: tokenMesero,
    body: {
      mesa: 'Mesa 1',
      platillos: [{ nombre: 'Plato', precio, productos: [] }],
    },
  });
  return res.data;
};

describe('Apertura de turno', () => {
  test('El admin puede abrir un turno', async () => {
    const res = await req(base, 'POST', '/api/turnos', {
      token: ctx.token,
      body: { nombre: 'Turno 1', efectivoInicial: 50000 },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.estado, 'Abierto');
    assert.equal(res.data.nombre, 'Turno 1');
    assert.equal(res.data.efectivoInicial, 50000);
  });

  test('El turno necesita nombre', async () => {
    const res = await req(base, 'POST', '/api/turnos', { token: ctx.token, body: {} });
    assert.equal(res.status, 400);
  });

  test('No se puede abrir un segundo turno si ya hay uno abierto', async () => {
    const res = await req(base, 'POST', '/api/turnos', {
      token: ctx.token,
      body: { nombre: 'Turno 2' },
    });

    assert.equal(res.status, 409);
  });

  test('El mesero no puede abrir un turno', async () => {
    const res = await req(base, 'POST', '/api/turnos', {
      token: tokenMesero,
      body: { nombre: 'Turno del mesero' },
    });

    assert.equal(res.status, 403);
  });
});

describe('Las comandas pertenecen al turno abierto', () => {
  let turno;

  before(async () => {
    // Se cierra el turno abierto en el bloque anterior para partir de cero.
    const turnos = await req(base, 'GET', '/api/turnos', { token: ctx.token });
    const abierto = turnos.data.find((t) => t.estado === 'Abierto');
    if (abierto) {
      await req(base, 'PATCH', `/api/turnos/${abierto._id}/cierre`, {
        token: ctx.token,
        body: { efectivoFinal: 0 },
      });
    }

    turno = await abrirTurno('Turno de la noche', 80000);
  });

  test('Una comanda creada con un turno abierto queda en ese turno', async () => {
    const comanda = await crearComanda(10000);

    assert.ok(comanda.turno, 'La comanda no tiene turno asignado');
    assert.equal(String(comanda.turno), String(turno._id));
  });

  test('Al cerrar el turno se cuentan las comandas y las ventas', async () => {
    await crearComanda(10000);
    await crearComanda(20000);

    const res = await req(base, 'PATCH', `/api/turnos/${turno._id}/cierre`, {
      token: ctx.token,
      body: { efectivoFinal: 150000 },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.turno.estado, 'Cerrado');
    assert.equal(res.data.turno.totales.pedidos, 3, 'No se contaron todas las comandas');
    // Ninguna estaba servida todavia, asi que no hay ventas cobradas.
    assert.equal(res.data.turno.totales.pedidosServidos, 0);
    assert.equal(res.data.turno.totales.total, 0);
    assert.equal(res.data.turno.efectivoFinal, 150000);
  });

  test('Las comandas servidas si cuentan en las ventas', async () => {
    const turno2 = await abrirTurno('Turno 2', 0);

    const comanda = await crearComanda(10800);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: tokenMesero });

    const res = await req(base, 'PATCH', `/api/turnos/${turno2._id}/cierre`, {
      token: ctx.token,
      body: { efectivoFinal: 10800 },
    });

    assert.equal(res.data.turno.totales.pedidos, 1);
    assert.equal(res.data.turno.totales.pedidosServidos, 1);
    // 10800 con INC 8%: base 10000, impuesto 800.
    assert.equal(res.data.turno.totales.subtotal, 10000);
    assert.equal(res.data.turno.totales.impuesto, 800);
    assert.equal(res.data.turno.totales.total, 10800);
  });

  test('Un turno cerrado no se puede volver a cerrar', async () => {
    const turnos = await req(base, 'GET', '/api/turnos', { token: ctx.token });
    const cerrado = turnos.data.find((t) => t.estado === 'Cerrado');

    const res = await req(base, 'PATCH', `/api/turnos/${cerrado._id}/cierre`, {
      token: ctx.token,
      body: { efectivoFinal: 0 },
    });

    assert.equal(res.status, 409);
  });

  test('Tras cerrar el turno, las comandas nuevas quedan sin turno', async () => {
    const comanda = await crearComanda(5000);
    assert.equal(comanda.turno, null, 'La comanda se asigno a un turno inexistente');
  });
});

describe('Consulta y aislamiento de turnos', () => {
  test('El detalle de un turno trae sus comandas', async () => {
    const turno = await abrirTurno('Turno con detalle', 0);
    const comanda = await crearComanda(7000);

    const res = await req(base, 'GET', `/api/turnos/${turno._id}`, { token: ctx.token });

    assert.equal(res.status, 200);
    assert.equal(res.data.turno.nombre, 'Turno con detalle');
    assert.ok(res.data.comandas.some((c) => c._id === comanda._id));
  });

  test('El listado de turnos solo trae los de su empresa', async () => {
    const otra = await crearEmpresaDePrueba(base, Date.now() + 1);
    await req(base, 'POST', '/api/turnos', {
      token: otra.token,
      body: { nombre: 'Turno ajeno' },
    });

    const res = await req(base, 'GET', '/api/turnos', { token: ctx.token });

    assert.ok(!res.data.some((t) => t.nombre === 'Turno ajeno'), 'Sefiltró un turno de otra empresa');

    await eliminarEmpresaDePrueba(base, otra);
  });

  test('No se puede cerrar un turno de otra empresa', async () => {
    const otra = await crearEmpresaDePrueba(base, Date.now() + 2);
    const turnoAjeno = await req(base, 'POST', '/api/turnos', {
      token: otra.token,
      body: { nombre: 'Turno ajeno 2' },
    });

    const res = await req(base, 'PATCH', `/api/turnos/${turnoAjeno.data._id}/cierre`, {
      token: ctx.token,
      body: { efectivoFinal: 0 },
    });

    assert.equal(res.status, 404);

    await eliminarEmpresaDePrueba(base, otra);
  });

  test('Sin token responde 401', async () => {
    const res = await req(base, 'GET', '/api/turnos');
    assert.equal(res.status, 401);
  });
});
