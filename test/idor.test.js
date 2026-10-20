// test/idor.test.js
// Aislamiento entre empresas: un usuario de la empresa A no puede leer ni
// modificar datos de la empresa B.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  iniciarServidor,
  req,
  crearEmpresaDePrueba,
  eliminarEmpresaDePrueba,
  crearUsuarioDePrueba,
} = require('./helpers');

let ctxA;
let ctxB;
let base;
let servidor;
let datosB;

before(async () => {
  servidor = await iniciarServidor();
  base = servidor.base;

  const sufijo = Date.now();
  ctxA = await crearEmpresaDePrueba(base, sufijo);
  ctxB = await crearEmpresaDePrueba(base, sufijo + 1);

  // Datos de la empresa B, para intentar operarlos desde la empresa A.
  const plato = await req(base, 'POST', '/api/platos', {
    token: ctxB.token,
    body: { nombre: 'Plato B', precio: 100, contenido: [] },
  });
  const ingrediente = await req(base, 'POST', '/api/ingredientes', {
    token: ctxB.token,
    body: { nombre: 'Ingrediente B', cantidad: 10, unidad: 'kg' },
  });
  const producto = await req(base, 'POST', '/api/productos', {
    token: ctxB.token,
    body: { nombre: 'Producto B', ingredientesUsados: [] },
  });
  const comanda = await req(base, 'POST', '/api/comandas', {
    token: ctxB.token,
    body: { mesa: 'Mesa 9', platillos: [{ nombre: 'Plato B', precio: 100, productos: ['Sopa'] }] },
  });

  const usuariosB = await req(base, 'GET', '/api/usuarios', { token: ctxB.token });

  datosB = {
    plato: plato.data,
    ingrediente: ingrediente.data,
    producto: producto.data,
    comanda: comanda.data,
    usuario: usuariosB.data[0],
  };
});

after(async () => {
  await eliminarEmpresaDePrueba(base, ctxA);
  await eliminarEmpresaDePrueba(base, ctxB);
  await servidor.detener();
});

describe('Operar datos de otra empresa', () => {
  test('PUT /api/comandas/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'PUT', `/api/comandas/${datosB.comanda._id}`, {
      token: ctxA.token,
      body: { platillos: [{ nombre: 'Hackeado', precio: 1, productos: [] }] },
    });
    assert.equal(res.status, 404);
  });

  test('PATCH /api/comandas/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${datosB.comanda._id}`, { token: ctxA.token });
    assert.equal(res.status, 404);
  });

  test('DELETE /api/comandas/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'DELETE', `/api/comandas/${datosB.comanda._id}`, { token: ctxA.token });
    assert.equal(res.status, 404);
  });

  test('PATCH /api/comandas/:id/imprimir de otra empresa responde 404', async () => {
    const res = await req(base, 'PATCH', `/api/comandas/${datosB.comanda._id}/imprimir`, {
      token: ctxA.token,
    });
    assert.equal(res.status, 404);
  });

  test('PUT /api/platos/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'PUT', `/api/platos/${datosB.plato._id}`, {
      token: ctxA.token,
      body: { nombre: 'Hackeado' },
    });
    assert.equal(res.status, 404);
  });

  test('DELETE /api/platos/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'DELETE', `/api/platos/${datosB.plato._id}`, { token: ctxA.token });
    assert.equal(res.status, 404);
  });

  test('PUT /api/productos/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'PUT', `/api/productos/${datosB.producto._id}`, {
      token: ctxA.token,
      body: { nombre: 'Hackeado' },
    });
    assert.equal(res.status, 404);
  });

  test('PUT /api/ingredientes/:id de otra empresa responde 404', async () => {
    const res = await req(base, 'PUT', `/api/ingredientes/${datosB.ingrediente._id}`, {
      token: ctxA.token,
      body: { cantidad: 999 },
    });
    assert.equal(res.status, 404);
  });

  test('PUT /api/usuarios/:id de otra empresa responde 404 (no hay secuestro)', async () => {
    const res = await req(base, 'PUT', `/api/usuarios/${datosB.usuario._id}`, {
      token: ctxA.token,
      body: { nombre: 'Secuestrado', empresa: ctxA.empresa._id },
    });
    assert.equal(res.status, 404);
  });

  test('Los datos de la empresa B siguen intactos', async () => {
    const platos = await req(base, 'GET', '/api/platos', { token: ctxB.token });
    const plato = platos.data.find((p) => p._id === datosB.plato._id);
    assert.ok(plato, 'El plato de B desaparecio');
    assert.equal(plato.nombre, 'Plato B');

    const comandas = await req(base, 'GET', '/api/comandas', { token: ctxB.token });
    const comanda = comandas.data.find((c) => c._id === datosB.comanda._id);
    assert.ok(comanda, 'La comanda de B desaparecio');
    assert.equal(comanda.estado, false, 'La comanda de B se completo desde la empresa A');
  });
});

describe('Mass assignment: escribir campos que no se deben', () => {
  test('PUT /api/platos ignora "empresa" y "_id" del body', async () => {
    const creado = await req(base, 'POST', '/api/platos', {
      token: ctxA.token,
      body: { nombre: 'Plato A', precio: 200, contenido: [] },
    });

    const res = await req(base, 'PUT', `/api/platos/${creado.data._id}`, {
      token: ctxA.token,
      body: {
        nombre: 'Plato A renombrado',
        empresa: ctxB.empresa._id,
        _id: '000000000000000000000000',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.empresa, ctxA.empresa._id, 'El plato cambio de empresa');
    assert.equal(res.data._id, creado.data._id, 'Se modifico el _id');
  });

  test('POST /api/platos ignora "empresa" del body', async () => {
    const res = await req(base, 'POST', '/api/platos', {
      token: ctxA.token,
      body: { nombre: 'Plato Intruso', precio: 1, contenido: [], empresa: ctxB.empresa._id },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.empresa, ctxA.empresa._id);
  });
});

describe('Permisos de escritura por rol', () => {
  test('Mesero no puede crear platos, productos ni ingredientes', async () => {
    const token = await crearUsuarioDePrueba(base, ctxA, 'Mesero', Date.now());

    const platos = await req(base, 'POST', '/api/platos', {
      token,
      body: { nombre: 'X', precio: 1, contenido: [] },
    });
    assert.equal(platos.status, 403);

    const productos = await req(base, 'POST', '/api/productos', {
      token,
      body: { nombre: 'X', ingredientesUsados: [] },
    });
    assert.equal(productos.status, 403);

    const ingredientes = await req(base, 'POST', '/api/ingredientes', {
      token,
      body: { nombre: 'X', cantidad: 1 },
    });
    assert.equal(ingredientes.status, 403);
  });

  test('Cocina no puede tomar pedidos ni editar comandas', async () => {
    const token = await crearUsuarioDePrueba(base, ctxA, 'Cocina', Date.now() + 1);

    const crear = await req(base, 'POST', '/api/comandas', {
      token,
      body: { mesa: 'M1', platillos: [{ nombre: 'X', precio: 1, productos: [] }] },
    });
    assert.equal(crear.status, 403);

    const comanda = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { mesa: 'M1', platillos: [{ nombre: 'X', precio: 1, productos: [] }] },
    });

    const editar = await req(base, 'PUT', `/api/comandas/${comanda.data._id}`, {
      token,
      body: { platillos: [{ nombre: 'X', precio: 1, productos: [] }] },
    });
    assert.equal(editar.status, 403);
  });

  test('Mesero no puede borrar una comanda', async () => {
    const token = await crearUsuarioDePrueba(base, ctxA, 'Mesero', Date.now() + 2);

    const comanda = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { mesa: 'M1', platillos: [{ nombre: 'X', precio: 1, productos: [] }] },
    });

    const res = await req(base, 'DELETE', `/api/comandas/${comanda.data._id}`, { token });
    assert.equal(res.status, 403);
  });
});

describe('La cocina no ve los precios', () => {
  test('Cocina recibe las comandas sin el campo precio', async () => {
    const tokenCocina = await crearUsuarioDePrueba(base, ctxA, 'Cocina', Date.now() + 3);

    const comanda = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { mesa: 'M3', platillos: [{ nombre: 'Plato A', precio: 20000, productos: ['Sopa'] }] },
    });

    const vista = await req(base, 'GET', '/api/comandas', { token: tokenCocina });
    const encontrada = vista.data.find((c) => c._id === comanda.data._id);

    assert.ok(encontrada, 'La cocina no recibio la comanda');
    for (const platillo of encontrada.platillos) {
      assert.equal(platillo.precio, undefined, 'La cocina ve el precio del platillo');
    }
  });

  test('El Admin si ve los precios', async () => {
    const comanda = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { mesa: 'M4', platillos: [{ nombre: 'Plato A', precio: 20000, productos: ['Sopa'] }] },
    });

    const vista = await req(base, 'GET', '/api/comandas', { token: ctxA.token });
    const encontrada = vista.data.find((c) => c._id === comanda.data._id);

    assert.ok(encontrada);
    assert.equal(encontrada.platillos[0].precio, 20000);
  });
});

describe('Validacion de entrada', () => {
  test('Una comanda sin mesa responde 400', async () => {
    const res = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { platillos: [{ nombre: 'X', precio: 1 }] },
    });
    assert.equal(res.status, 400);
  });

  test('Una comanda sin platillos responde 400', async () => {
    const res = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { mesa: 'M1', platillos: [] },
    });
    assert.equal(res.status, 400);
  });

  test('Un precio no numerico responde 400', async () => {
    const res = await req(base, 'POST', '/api/comandas', {
      token: ctxA.token,
      body: { mesa: 'M1', platillos: [{ nombre: 'X', precio: 'gratis' }] },
    });
    assert.equal(res.status, 400);
  });

  test('Una cantidad de ingrediente negativa responde 400', async () => {
    const ingrediente = await req(base, 'POST', '/api/ingredientes', {
      token: ctxA.token,
      body: { nombre: 'Ing Negativo', cantidad: 5, unidad: 'kg' },
    });

    const res = await req(base, 'PUT', `/api/ingredientes/${ingrediente.data._id}`, {
      token: ctxA.token,
      body: { cantidad: -50 },
    });
    assert.equal(res.status, 400);
  });
});
