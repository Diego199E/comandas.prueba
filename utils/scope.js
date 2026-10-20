// utils/scope.js
// Helpers centralizados para el aislamiento multi-empresa (multi-tenancy).
//
// REGLA DE ORO DEL PROYECTO:
//   Toda consulta o escritura sobre datos de una empresa debe filtrar por la
//   empresa del usuario autenticado. Este archivo es el unico lugar donde se
//   decide de donde sale ese identificador, para que la regla se aplique igual
//   en todos los controllers.

/**
 * Devuelve el ObjectId de la empresa a la que pertenece el usuario autenticado.
 *
 * req.empresaId lo inyecta el middleware verificarToken. Se acepta el fallback
 * sobre req.usuario para que los controllers puedan usarse tambien en pruebas
 * unitarias que armen req a mano.
 *
 * @param {import('express').Request} req
 * @returns {import('mongoose').Types.ObjectId|null}
 */
function empresaIdDe(req) {
  const desdeMiddleware = req?.empresaId;
  if (desdeMiddleware) return desdeMiddleware;

  const ref = req?.usuario?.empresa;
  if (!ref) return null;

  // Si el usuario fue populado, empresa es un documento y su _id es el ObjectId.
  // Si no fue populado, empresa ya es el ObjectId crudo.
  return ref._id ? ref._id : ref;
}

/**
 * Construye un filtro de mongoose que exige pertenencia a la empresa del usuario.
 *
 * @param {import('express').Request} req
 * @param {object} [extra] condiciones adicionales (por ejemplo { _id: id })
 * @returns {object}
 */
function filtroEmpresa(req, extra = {}) {
  return { ...extra, empresa: empresaIdDe(req) };
}

/**
 * Igual que filtroEmpresa pero solo con la empresa (sin condiciones extra).
 * @param {import('express').Request} req
 * @returns {object}
 */
function soloEmpresa(req) {
  return filtroEmpresa(req);
}

module.exports = { empresaIdDe, filtroEmpresa, soloEmpresa };
