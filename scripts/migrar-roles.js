// scripts/migrar-roles.js
// Migracion de una sola vez: los usuarios que quedaron con el rol antiguo
// 'Vendedor' (residuo de una plantilla de POS) pasan a 'Mesero'.
//
// Uso:  npm run migrate:roles
//
// Es idempotente: ejecutarlo de nuevo no afecta a los usuarios ya migrados.

const mongoose = require('mongoose');
const { MONGO_URI } = require('../config/env');

const ROL_ANTIGUO = 'Vendedor';
const ROL_NUEVO = 'Mesero';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    const resultado = await mongoose.connection
      .collection('usuarios')
      .updateMany({ rol: ROL_ANTIGUO }, { $set: { rol: ROL_NUEVO } });

    console.log(
      `✅ Usuarios migrados de "${ROL_ANTIGUO}" a "${ROL_NUEVO}": ${resultado.modifiedCount}`
    );

    // Comprobacion: quedan roles fuera del catalogo actual?
    const validos = ['Admin', 'Mesero', 'Cocina'];
    const rolesInvalidos = await mongoose.connection
      .collection('usuarios')
      .aggregate([{ $group: { _id: '$rol', total: { $sum: 1 } } }])
      .toArray();

    const fueraDeCatalogo = rolesInvalidos.filter((r) => !validos.includes(r._id));
    if (fueraDeCatalogo.length > 0) {
      console.warn('⚠️  Roles fuera del catalogo actual:', fueraDeCatalogo);
    } else {
      console.log('✅ Todos los usuarios tienen un rol valido');
    }
  } catch (error) {
    console.error('❌ Error en la migracion:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
