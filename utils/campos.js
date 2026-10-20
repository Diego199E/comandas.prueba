// utils/campos.js
// Helpers para evitar "mass assignment": que el cliente pueda escribir
// cualquier campo del documento (empresa, _id, estado, etc.) al actualizar.
//
// Uso en los controllers:
//
//   const datos = soloCampos(req.body, ['nombre', 'precio', 'contenido']);
//   await Plato.findOneAndUpdate(filtroEmpresa(req, { _id: id }), datos, { new: true });
//
// REGLA: si un campo no esta en la lista blanca, el cliente no lo puede tocar.

/**
 * Devuelve un objeto con SOLO las claves permitidas que existan en la fuente.
 *
 * @param {object} fuente objeto de entrada (normalmente req.body)
 * @param {string[]} permitidos lista blanca de claves
 * @returns {object} objeto nuevo con las claves permitidas
 */
function soloCampos(fuente, permitidos) {
  const salida = {};

  if (!fuente || typeof fuente !== 'object') return salida;

  for (const clave of permitidos) {
    if (fuente[clave] !== undefined) {
      salida[clave] = fuente[clave];
    }
  }

  return salida;
}

module.exports = { soloCampos };
