// test/seguridad.test.js
// Verificacion de la matriz de autorizacion (ver MATRIZ-ACCESO.md).
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

before(async () => {
  servidor = await iniciarServidor();
  base = servidor.base;
  ctx = await crearEmpresaDePrueba(base, Date.now());
});

after(async () => {
  await eliminarEmpresaDePrueba(base, ctx);
  await servidor.detener();
});

describe('Rutas que antes eran publicas', () => {
  test('GET /api/usuarios sin token responde 401', async () => {
    const res = await req(base, 'GET', '/api/usuarios');
    assert.equal(res.status, 401);
  });

  test('GET /api/usuarios con rol Mesero responde 403', async () => {
    const tokenMesero = await crearUsuarioDePrueba(base, ctx, 'Mesero', Date.now());
    const res = await req(base, 'GET', '/api/usuarios', { token: tokenMesero });
    assert.equal(res.status, 403);
  });

  test('GET /api/usuarios con Admin responde 200 sin hash de contrasena', async () => {
    const res = await req(base, 'GET', '/api/usuarios', { token: ctx.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    for (const usuario of res.data) {
      assert.equal('contraseña' in usuario, false, 'La respuesta expone el hash de contrasena');
    }
  });

  test('POST /api/auth/register sin token responde 401', async () => {
    const res = await req(base, 'POST', '/api/auth/register', {
      body: {
        nombre: 'Hacker',
        apellido: 'Malvado',
        correo: `hacker.${Date.now()}@test.com`,
        contraseña: '123456',
        rol: 'Admin',
      },
    });
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/register con rol Admin desde un Mesero responde 403', async () => {
    const tokenMesero = await crearUsuarioDePrueba(base, ctx, 'Mesero', Date.now() + 1);
    const res = await req(base, 'POST', '/api/auth/register', {
      token: tokenMesero,
      body: {
        nombre: 'Escalada',
        apellido: 'X',
        correo: `escalada.${Date.now()}@test.com`,
        contraseña: 'clave123',
        rol: 'Admin',
      },
    });
    assert.equal(res.status, 403);
  });

  test('La ruta que listaba todas las empresas ya no existe (404)', async () => {
    const res = await req(base, 'GET', '/api/empresa');
    assert.equal(res.status, 404);
  });

  test('No se puede crear una empresa por la ruta vieja (404)', async () => {
    const res = await req(base, 'POST', '/api/empresa', {
      body: { nombre: 'Hack', nit: '123456789', razonSocial: 'H' },
    });
    assert.equal(res.status, 404);
  });

  test('GET /api/platos sin token responde 401', async () => {
    const res = await req(base, 'GET', '/api/platos');
    assert.equal(res.status, 401);
  });

  test('GET /api/comandas sin token responde 401', async () => {
    const res = await req(base, 'GET', '/api/comandas');
    assert.equal(res.status, 401);
  });

  test('DELETE /api/comandas (todas) con Mesero responde 403', async () => {
    const tokenMesero = await crearUsuarioDePrueba(base, ctx, 'Mesero', Date.now() + 2);
    const res = await req(base, 'DELETE', '/api/comandas', { token: tokenMesero });
    assert.equal(res.status, 403);
  });
});

describe('Alta transaccional de empresa', () => {
  test('POST /api/empresa/registro crea empresa y administrador', async () => {
    const sufijo = Date.now();
    const res = await req(base, 'POST', '/api/empresa/registro', {
      body: {
        nombre: `Restaurante Alta ${sufijo}`,
        nit: `8${String(sufijo).slice(-8)}`,
        razonSocial: 'Alta SA',
        nombreAdmin: 'Admin',
        apellidoAdmin: 'Alta',
        correoAdmin: `alta.${sufijo}@test.com`,
        contraseñaAdmin: 'secreta123',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.token, 'La respuesta debe incluir el token del nuevo admin');
    assert.equal(res.data.empresa.nombre, `Restaurante Alta ${sufijo}`);

    await req(base, 'DELETE', '/api/empresa/mi', {
      token: res.data.token,
      body: { confirmarContraseña: 'secreta123' },
    });
  });

  test('No se puede registrar una empresa con NIT duplicado', async () => {
    const res = await req(base, 'POST', '/api/empresa/registro', {
      body: {
        nombre: 'Otro nombre distinto',
        nit: ctx.empresa.nit,
        razonSocial: 'Duplicada SA',
        nombreAdmin: 'Admin',
        apellidoAdmin: 'Duplicado',
        correoAdmin: `dup.${Date.now()}@test.com`,
        contraseñaAdmin: 'secreta123',
      },
    });
    assert.equal(res.status, 400);
  });
});

describe('Login', () => {
  test('Credenciales incorrectas responden 401', async () => {
    const res = await req(base, 'POST', '/api/auth/login', {
      body: { correo: ctx.correo, contraseña: 'incorrecta' },
    });
    assert.equal(res.status, 401);
  });

  test('Un correo inexistente responde 401 con el mismo mensaje', async () => {
    const res = await req(base, 'POST', '/api/auth/login', {
      body: { correo: 'nadie@test.com', contraseña: 'x' },
    });
    assert.equal(res.status, 401);
    assert.equal(res.data.mensaje, 'Credenciales incorrectas');
  });

  test('Login correcto devuelve token', async () => {
    const res = await req(base, 'POST', '/api/auth/login', {
      body: { correo: ctx.correo, contraseña: ctx.contrasena },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
  });
});

describe('Control de los datos de la empresa', () => {
  test('PUT /api/empresa/mi no permite auto-desactivar ni auto-despagar', async () => {
    const res = await req(base, 'PUT', '/api/empresa/mi', {
      token: ctx.token,
      body: { razonSocial: 'Cambiada SA', pagoRealizado: false, activa: false },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.empresa.pagoRealizado, true);
    assert.equal(res.data.empresa.activa, true);
  });

  test('DELETE /api/empresa/mi exige confirmar la contrasena', async () => {
    const res = await req(base, 'DELETE', '/api/empresa/mi', { token: ctx.token, body: {} });
    assert.equal(res.status, 400);
  });
});
