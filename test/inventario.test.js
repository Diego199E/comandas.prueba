// test/inventario.test.js
// Descuento de inventario idempotente (ver DOCUMENTO-DESCUENTO-INVENTARIO.md).
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
let ing;
let ing2;
let prod;
let prodB;

const stockDe = async (nombre) => {
  const res = await req(base, 'GET', '/api/ingredientes', { token: ctx.token });
  const encontrado = res.data.find((i) => i.nombre === nombre);
  return encontrado ? encontrado.cantidad : null;
};

const crearComanda = async (mesa, productos) =>
  (
    await req(base, 'POST', '/api/comandas', {
      token: ctx.token,
      body: { mesa, platillos: [{ nombre: 'Desayuno', precio: 100, productos }] },
    })
  ).data;

before(async () => {
  servidor = await iniciarServidor();
  base = servidor.base;
  ctx = await crearEmpresaDePrueba(base, Date.now());

  ing = (
    await req(base, 'POST', '/api/ingredientes', {
      token: ctx.token,
      body: { nombre: 'Harina', cantidad: 100, unidad: 'kg' },
    })
  ).data;

  ing2 = (
    await req(base, 'POST', '/api/ingredientes', {
      token: ctx.token,
      body: { nombre: 'Azucar', cantidad: 50, unidad: 'kg' },
    })
  ).data;

  prod = (
    await req(base, 'POST', '/api/productos', {
      token: ctx.token,
      body: {
        nombre: 'Pan',
        ingredientesUsados: [
          { ingrediente: ing._id, cantidadUsada: 10 },
          { ingrediente: ing2._id, cantidadUsada: 2 },
        ],
      },
    })
  ).data;

  prodB = (
    await req(base, 'POST', '/api/productos', {
      token: ctx.token,
      body: { nombre: 'Bizcocho', ingredientesUsados: [{ ingrediente: ing._id, cantidadUsada: 5 }] },
    })
  ).data;

  await req(base, 'POST', '/api/platos', {
    token: ctx.token,
    body: { nombre: 'Desayuno', precio: 100, contenido: [{ categoria: 'Principal', valor: 'Pan' }] },
  });
});

after(async () => {
  await eliminarEmpresaDePrueba(base, ctx);
  await servidor.detener();
});

describe('Descuento de stock', () => {
  test('Completar una comanda descuenta lo que dice la receta', async () => {
    const antesHarina = await stockDe('Harina');
    const antesAzucar = await stockDe('Azucar');
    const comanda = await crearComanda('M1', ['Pan']);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(await stockDe('Harina'), antesHarina - 10);
    assert.equal(await stockDe('Azucar'), antesAzucar - 2);
  });

  test('Completar 5 veces la misma comanda descuenta una sola vez', async () => {
    const antes = await stockDe('Harina');
    const comanda = await crearComanda('M2', ['Pan']);

    for (let i = 0; i < 5; i++) {
      await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });
    }

    assert.equal(await stockDe('Harina'), antes - 10);
  });

  test('La segunda respuesta indica que ya estaba descontado', async () => {
    const comanda = await crearComanda('M2b', ['Pan']);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });
    const segunda = await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(segunda.data.stock.yaDescontado, true);
    assert.equal(segunda.data.stock.aplicado, false);
  });

  test('8 PATCH simultaneos descuetan una sola vez', async () => {
    const antes = await stockDe('Harina');
    const comanda = await crearComanda('M3', ['Pan']);

    await Promise.all(
      Array.from({ length: 8 }, () =>
        req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token })
      )
    );

    assert.equal(await stockDe('Harina'), antes - 10);
  });

  test('Dos productos con el mismo ingrediente restan la suma', async () => {
    const antes = await stockDe('Harina');
    const comanda = await crearComanda('M4', ['Pan', 'Bizcocho']);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(await stockDe('Harina'), antes - 15);
  });

  test('Dos comandas distintas se descuentan por separado', async () => {
    const antes = await stockDe('Harina');
    const c1 = await crearComanda('M5', ['Pan']);
    const c2 = await crearComanda('M6', ['Pan']);

    await req(base, 'PATCH', `/api/comandas/${c1._id}`, { token: ctx.token });
    await req(base, 'PATCH', `/api/comandas/${c2._id}`, { token: ctx.token });

    assert.equal(await stockDe('Harina'), antes - 20);
  });
});

describe('Reversion al borrar', () => {
  test('Borrar una comanda completada devuelve el stock', async () => {
    const antes = await stockDe('Harina');
    const comanda = await crearComanda('M7', ['Pan']);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    const res = await req(base, 'DELETE', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(res.status, 200);
    assert.equal(res.data.stockRevertido, true);
    assert.equal(await stockDe('Harina'), antes);
  });
});

describe('El descuento usa el id del producto, no el nombre', () => {
  test('Renombrar el producto no rompe el descuento', async () => {
    const antes = await stockDe('Harina');
    const comanda = await crearComanda('M8', ['Pan']);

    await req(base, 'PUT', `/api/productos/${prod._id}`, {
      token: ctx.token,
      body: { nombre: 'Pan Artesanal' },
    });

    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });
    assert.equal(await stockDe('Harina'), antes - 10);

    // Se devuelve el nombre original para el resto de pruebas.
    await req(base, 'PUT', `/api/productos/${prod._id}`, {
      token: ctx.token,
      body: { nombre: 'Pan' },
    });
  });
});

describe('Avisos del proceso', () => {
  test('Un plato enviado sin productos no descuenta y deja aviso', async () => {
    const antes = await stockDe('Harina');
    const comanda = await crearComanda('M9', []);

    const res = await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(await stockDe('Harina'), antes);
    assert.ok(
      res.data.stock.alertas.some((a) => a.includes('sin productos seleccionados')),
      'No se registro el aviso de plato sin productos'
    );
  });

  test('Un producto cuyo ingrediente fue borrado avisa y omite', async () => {
    const temporal = (
      await req(base, 'POST', '/api/ingredientes', {
        token: ctx.token,
        body: { nombre: 'Temporal', cantidad: 100, unidad: 'kg' },
      })
    ).data;

    await req(base, 'POST', '/api/productos', {
      token: ctx.token,
      body: {
        nombre: 'Producto Huerfano',
        ingredientesUsados: [{ ingrediente: temporal._id, cantidadUsada: 7 }],
      },
    });

    await req(base, 'DELETE', `/api/ingredientes/${temporal._id}`, { token: ctx.token });

    const comanda = await crearComanda('M10', ['Producto Huerfano']);
    const res = await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(res.status, 200);
    assert.ok(
      res.data.stock.alertas.some((a) => a.includes('ya no existe')),
      'No se registro el aviso de ingrediente inexistente'
    );
  });

  test('El stock insuficiente deja el valor en negativo y avisa', async () => {
    await req(base, 'PUT', `/api/ingredientes/${ing2._id}`, {
      token: ctx.token,
      body: { cantidad: 1 },
    });

    const comanda = await crearComanda('M11', ['Pan']);
    const res = await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    assert.equal(res.status, 200);
    assert.ok((await stockDe('Azucar')) < 0, 'El stock deberia quedar en negativo');
    assert.ok(
      res.data.stock.alertas.some((a) => a.includes('negativo')),
      'No se registro el aviso de stock negativo'
    );
  });
});

describe('Trazabilidad', () => {
  test('La comanda registra que ya se descontó el stock', async () => {
    const comanda = await crearComanda('M12', ['Pan']);
    await req(base, 'PATCH', `/api/comandas/${comanda._id}`, { token: ctx.token });

    const listado = await req(base, 'GET', '/api/comandas', { token: ctx.token });
    const guardada = listado.data.find((c) => c._id === comanda._id);

    assert.equal(guardada.stockDescontado, true);
    assert.ok(guardada.stockDescontadoEn, 'No se registro la fecha del descuento');
  });
});
