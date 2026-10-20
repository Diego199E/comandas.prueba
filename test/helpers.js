// test/helpers.js
// Utilidades compartidas por las pruebas: arranque del servidor en el mismo
// proceso y helpers de asercion.
const mongoose = require('mongoose');
const assert = require('node:assert/strict');

const app = require('../app');
const { MONGO_URI } = require('../config/env');

/**
 * Levanta la API en un puerto libre, dentro del propio proceso de pruebas.
 * Asi `npm test` no necesita el servidor corriendo en otra terminal.
 */
async function iniciarServidor() {
  await mongoose.connect(MONGO_URI);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    server,
    base,
    async detener() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
    },
  };
}

/**
 * Peticion HTTP contra la API de pruebas.
 */
async function req(base, method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    data = texto;
  }

  return { status: res.status, data };
}

/**
 * Crea una empresa de prueba con su administrador y devuelve el contexto.
 * Hay que eliminarla al final con eliminarEmpresaDePrueba.
 */
async function crearEmpresaDePrueba(base, sufijo) {
  const res = await req(base, 'POST', '/api/empresa/registro', {
    body: {
      nombre: `Restaurante Prueba ${sufijo}`,
      nit: `9${String(sufijo).slice(-8)}`,
      razonSocial: `Restaurante Prueba ${sufijo} SA`,
      nombreAdmin: 'Admin',
      apellidoAdmin: 'Prueba',
      correoAdmin: `admin.${sufijo}@test.com`,
      contraseñaAdmin: 'secreta123',
    },
  });

  assert.equal(res.status, 201, `No se pudo crear la empresa de prueba: ${JSON.stringify(res.data)}`);

  return {
    token: res.data.token,
    empresa: res.data.empresa,
    correo: `admin.${sufijo}@test.com`,
    contrasena: 'secreta123',
  };
}

/**
 * Elimina una empresa de prueba (con todos sus datos en cascada).
 */
async function eliminarEmpresaDePrueba(base, ctx) {
  await req(base, 'DELETE', '/api/empresa/mi', {
    token: ctx.token,
    body: { confirmarContraseña: ctx.contrasena },
  });
}

/**
 * Crea un usuario con un rol dentro de la empresa de prueba.
 */
async function crearUsuarioDePrueba(base, ctx, rol, sufijo) {
  const res = await req(base, 'POST', '/api/auth/register', {
    token: ctx.token,
    body: {
      nombre: rol,
      apellido: 'Prueba',
      correo: `${rol.toLowerCase()}.${sufijo}@test.com`,
      contraseña: 'clave123',
      rol,
    },
  });

  assert.equal(res.status, 201, `No se pudo crear el usuario ${rol}: ${JSON.stringify(res.data)}`);

  const login = await req(base, 'POST', '/api/auth/login', {
    body: { correo: `${rol.toLowerCase()}.${sufijo}@test.com`, contraseña: 'clave123' },
  });

  assert.equal(login.status, 200, `No se pudo iniciar sesion como ${rol}`);

  return login.data.token;
}

module.exports = {
  iniciarServidor,
  req,
  crearEmpresaDePrueba,
  eliminarEmpresaDePrueba,
  crearUsuarioDePrueba,
};
