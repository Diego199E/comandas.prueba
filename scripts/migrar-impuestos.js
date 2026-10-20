// scripts/migrar-impuestos.js
// Ajuste del regimen de impuesto de las empresas.
//
// CONTEXTO: el modelo Empresa usaba usaIva por defecto en true (IVA 19%), pero
// el comprobante de venta imprimia "IMPUESTO AL CONSUMO (8%)" y el regimen
// habitual de los restaurantes en Colombia es el INC del 8% (Ley 2277 de 2023).
// Es decir, el sistema se contradecía a si mismo.
//
// Este script deja el flag coherente con el regimen real: las empresas
// quedan en INC 8% (usaIva = false). Si una empresa aplica IVA 19%, se
// cambia desde el panel (Mi Empresa) o aqui.
//
// Uso:  npm run migrate:impuestos
//
// Es idempotente.

const mongoose = require('mongoose');
const { MONGO_URI } = require('../config/env');

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    const resultado = await mongoose.connection
      .collection('empresas')
      .updateMany({ usaIva: { $ne: false } }, { $set: { usaIva: false } });

    console.log(`✅ Empresas ajustadas a INC 8%: ${resultado.modifiedCount}`);

    const empresas = await mongoose.connection
      .collection('empresas')
      .find({}, { projection: { nombre: 1, usaIva: 1 } })
      .toArray();

    console.log('Estado actual:');
    empresas.forEach((e) =>
      console.log(`  - ${e.nombre}: usaIva=${e.usaIva} (${e.usaIva ? 'IVA 19%' : 'INC 8%'})`)
    );
  } catch (error) {
    console.error('❌ Error en la migracion:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
