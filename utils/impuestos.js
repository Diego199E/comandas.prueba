// utils/impuestos.js
// Calculo de impuestos del backend.
//
// El frontend tiene su equivalente en src/utils/impuestos.js (ESM). Al ser
// dos repositorios distintos no se puede compartir el modulo, asi que la
// regla esta escrita en los dos lados y documentada en los dos:
//
//   usaIva = true  -> IVA del 19%
//   usaIva = false -> INC del 8% (regimen habitual de los restaurantes en
//                     Colombia, Ley 2277 de 2023)
//
// El precio del menu se guarda CON el impuesto incluido, por eso la base
// gravable se obtiene dividiendo.

const TASA_IVA = 0.19;
const TASA_INC = 0.08;

/**
 * Calcula la base gravable y el impuesto de un total.
 *
 * @param {number} total total con impuesto incluido
 * @param {boolean} [usaIva] true aplica IVA 19%, false aplica INC 8%
 * @returns {{base:number, impuesto:number, tasa:number}}
 */
function calcularImpuestos(total, usaIva = false) {
  const totalConImpuesto = Number(total) || 0;
  const tasa = usaIva ? TASA_IVA : TASA_INC;

  // Se redondea la base y el impuesto sale por diferencia: asi base +
  // impuesto siempre da exactamente el total, sin desfases de centavos.
  const base = Math.round(totalConImpuesto / (1 + tasa));
  const impuesto = totalConImpuesto - base;

  return { base, impuesto, tasa };
}

module.exports = { calcularImpuestos, TASA_IVA, TASA_INC };
