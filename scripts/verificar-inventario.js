// scripts/verificar-inventario.js
// Verificacion end-to-end del descuento de inventario (idempotencia).
//
// Requiere el backend corriendo en otra terminal:
//   npm run dev
//
// Ejecutar:
//   npm run verificar:inventario
//
// La suite crea su propia empresa de prueba y la elimina al final, asi que no
// toca los datos reales.
// Verificacion del descuento de inventario idempotente
const API = 'http://localhost:3001';

async function req(method, path, { body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  const txt = await res.text();
  try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: res.status, data };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FALLA'} | ${name}${detail ? ' -> ' + detail : ''}`);
};

(async () => {
  const suffix = Date.now();

  let r = await req('POST', '/api/empresa/registro', {
    body: {
      nombre: `Restaurante Inv ${suffix}`, nit: `905${String(suffix).slice(-6)}`, razonSocial: 'Inv SA',
      nombreAdmin: 'Admin', apellidoAdmin: 'Inv', correoAdmin: `inv.${suffix}@test.com`, contraseñaAdmin: 'secreta123',
    },
  });
  const token = r.data.token;
  if (!token) { console.log('No se pudo crear la empresa. Abortando.'); process.exit(1); }

  const stockDe = async (nombre) => {
    const rr = await req('GET', '/api/ingredientes', { token });
    const ing = (rr.data || []).find((i) => i.nombre === nombre);
    return ing ? ing.cantidad : null;
  };
  const crearComanda = async (mesa, productos) =>
    (await req('POST', '/api/comandas', {
      token, body: { mesa, platillos: [{ nombre: 'Desayuno', precio: 100, productos }] },
    })).data;

  // Catalogo
  const ing = (await req('POST', '/api/ingredientes', { token, body: { nombre: 'Harina', cantidad: 100, unidad: 'kg' } })).data;
  const ing2 = (await req('POST', '/api/ingredientes', { token, body: { nombre: 'Azucar', cantidad: 50, unidad: 'kg' } })).data;
  const prod = (await req('POST', '/api/productos', {
    token, body: { nombre: 'Pan', ingredientesUsados: [{ ingrediente: ing._id, cantidadUsada: 10 }, { ingrediente: ing2._id, cantidadUsada: 2 }] },
  })).data;
  const prodB = (await req('POST', '/api/productos', {
    token, body: { nombre: 'Bizcocho', ingredientesUsados: [{ ingrediente: ing._id, cantidadUsada: 5 }] },
  })).data;
  await req('POST', '/api/platos', {
    token, body: { nombre: 'Desayuno', precio: 100, contenido: [{ categoria: 'Principal', valor: 'Pan' }] },
  });

  console.log('\n--- 1. Descuento basico ---');
  let comanda = await crearComanda('M1', ['Pan']);
  r = await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  check('Descontar 1 comanda: Harina 100 -> 90', (await stockDe('Harina')) === 90, `Harina=${await stockDe('Harina')}`);
  check('Descontar 1 comanda: Azucar 50 -> 48', (await stockDe('Azucar')) === 48, `Azucar=${await stockDe('Azucar')}`);
  check('La respuesta informa que si se descontó', r.data?.stock?.aplicado === true && r.data?.stock?.yaDescontado === false,
    JSON.stringify(r.data?.stock));

  console.log('\n--- 2. Idempotencia: la misma comanda 5 veces ---');
  for (let i = 0; i < 5; i++) {
    r = await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  }
  check('5 PATCH sobre la misma comanda: Harina sigue en 90', (await stockDe('Harina')) === 90, `Harina=${await stockDe('Harina')}`);
  check('5 PATCH sobre la misma comanda: Azucar sigue en 48', (await stockDe('Azucar')) === 48, `Azucar=${await stockDe('Azucar')}`);
  check('El 2do PATCH informa "ya descontado"', r.data?.stock?.yaDescontado === true, JSON.stringify(r.data?.stock));
  check('El 2do PATCH no dice "ya estaba completada" sin motivo', typeof r.data?.mensaje === 'string', r.data?.mensaje);

  console.log('\n--- 3. Concurrencia: 8 PATCH simultaneos ---');
  comanda = await crearComanda('M2', ['Pan']);
  await Promise.all(Array.from({ length: 8 }, () => req('PATCH', `/api/comandas/${comanda._id}`, { token })));
  check('8 PATCH simultaneos: Harina 90 -> 80 (un solo descuento)', (await stockDe('Harina')) === 80, `Harina=${await stockDe('Harina')}`);

  console.log('\n--- 4. Acumulacion por ingrediente ---');
  const antesAcum = await stockDe('Harina');
  comanda = await crearComanda('M3', ['Pan', 'Bizcocho']);
  await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  check('Dos productos con el mismo ingrediente: se resta la suma (Pan 10 + Bizcocho 5)',
    (await stockDe('Harina')) === antesAcum - 15, `Harina=${await stockDe('Harina')} esperado=${antesAcum - 15}`);

  console.log('\n--- 5. Reversion al borrar la comanda ---');
  // antesAcum es el stock que habia ANTES de descontar esta comanda
  r = await req('DELETE', `/api/comandas/${comanda._id}`, { token });
  check('DELETE de comanda completada -> 200', r.status === 200, `status=${r.status}`);
  check('La respuesta informa que se revirtio el stock', r.data?.stockRevertido === true, JSON.stringify(r.data));
  check('El stock vuelve al valor previo al descuento', (await stockDe('Harina')) === antesAcum,
    `Harina=${await stockDe('Harina')} esperado=${antesAcum}`);

  console.log('\n--- 6. El descuento usa el ID, no el nombre ---');
  const antesRenombre = await stockDe('Harina');
  comanda = await crearComanda('M4', ['Pan']);       // se resuelve a id al crear
  await req('PUT', `/api/productos/${prod._id}`, { token, body: { nombre: 'Pan Artesanal' } });
  await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  check('Tras renombrar el Producto, el descuento se sigue aplicando', (await stockDe('Harina')) === antesRenombre - 10,
    `Harina=${await stockDe('Harina')} esperado=${antesRenombre - 10}`);
  // se devuelve el nombre original para los siguientes casos
  await req('PUT', `/api/productos/${prod._id}`, { token, body: { nombre: 'Pan' } });

  console.log('\n--- 7. Plato enviado sin productos: no descuenta y deja alerta ---');
  const stockAntesSinProductos = await stockDe('Harina');
  comanda = await crearComanda('M5', []);
  r = await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  check('Comanda sin productos: el stock NO cambia', (await stockDe('Harina')) === stockAntesSinProductos, `Harina=${await stockDe('Harina')}`);
  check('Comanda sin productos: se registra la alerta', (r.data?.stock?.alertas || []).some((a) => a.includes('sin productos seleccionados')),
    JSON.stringify(r.data?.stock?.alertas));

  console.log('\n--- 8. Producto con ingrediente inexistente: avisa y omite ---');
  const ingTemporal = (await req('POST', '/api/ingredientes', { token, body: { nombre: 'Temporal', cantidad: 100, unidad: 'kg' } })).data;
  await req('POST', '/api/productos', {
    token, body: { nombre: 'Producto Huerfano', ingredientesUsados: [{ ingrediente: ingTemporal._id, cantidadUsada: 7 }] },
  });
  await req('DELETE', `/api/ingredientes/${ingTemporal._id}`, { token });
  comanda = await crearComanda('M6', ['Producto Huerfano']);
  r = await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  check('Ingrediente borrado: la comanda se completa igual', r.status === 200, `status=${r.status}`);
  check('Ingrediente borrado: se genera una alerta', (r.data?.stock?.alertas || []).some((a) => a.includes('ya no existe')),
    JSON.stringify(r.data?.stock?.alertas));

  console.log('\n--- 9. Stock insuficiente: se permite y se avisa ---');
  await req('PUT', `/api/ingredientes/${ing2._id}`, { token, body: { cantidad: 1 } });
  comanda = await crearComanda('M7', ['Pan']);
  r = await req('PATCH', `/api/comandas/${comanda._id}`, { token });
  check('Stock insuficiente: la comanda se completa igual', r.status === 200, `status=${r.status}`);
  check('Stock insuficiente: queda en negativo', (await stockDe('Azucar')) < 0, `Azucar=${await stockDe('Azucar')}`);
  check('Stock insuficiente: se genera alerta de negativo', (r.data?.stock?.alertas || []).some((a) => a.includes('negativo')),
    JSON.stringify(r.data?.stock?.alertas));

  console.log('\n--- 10. Comandas distintas se descuentan por separado ---');
  await req('PUT', `/api/ingredientes/${ing._id}`, { token, body: { cantidad: 200 } });
  const c1 = await crearComanda('M8', ['Pan']);
  const c2 = await crearComanda('M9', ['Pan']);
  await req('PATCH', `/api/comandas/${c1._id}`, { token });
  await req('PATCH', `/api/comandas/${c2._id}`, { token });
  check('Dos comandas distintas: se descuenta dos veces (200 -> 180)', (await stockDe('Harina')) === 180, `Harina=${await stockDe('Harina')}`);

  console.log('\n--- 11. La comanda registra que ya se descontó ---');
  r = await req('GET', '/api/comandas', { token });
  const c1EnLista = (r.data || []).find((c) => c._id === c1._id);
  check('La comanda tiene stockDescontado = true', c1EnLista?.stockDescontado === true, `stockDescontado=${c1EnLista?.stockDescontado}`);
  check('La comanda tiene fecha de descuento', !!c1EnLista?.stockDescontadoEn, `${c1EnLista?.stockDescontadoEn}`);

  console.log('\n--- Limpieza ---');
  await req('DELETE', '/api/empresa/mi', { token, body: { confirmarContraseña: 'secreta123' } });

  const falhas = results.filter((x) => !x.ok);
  console.log('\n========================================');
  console.log(`Total: ${results.length} | OK: ${results.length - falhas.length} | FALLAS: ${falhas.length}`);
  if (falhas.length) { console.log('\nFallos:'); falhas.forEach((f) => console.log(`  - ${f.name} ${f.detail}`)); }
  console.log('========================================');
  process.exit(falhas.length ? 1 : 0);
})();
