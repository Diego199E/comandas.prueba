// config/env.js
// Carga y valida TODAS las variables de entorno del backend en un solo lugar.
//
// IMPORTANTE: este modulo debe requerirse ANTES que cualquier otro (app.js,
// server.js, middlewares, controllers). Si no, process.env todavia no tiene
// los valores de .env y los secretos caen a los valores por defecto.

require('dotenv').config({
  // Ruta explicita: dotenv busca el .env relativo al DIRECTORIO DE TRABAJO, no
  // al del modulo. Sin esto, arrancar el backend desde otra carpeta (o desde
  // un runner de pruebas) se quedaria sin MONGO_URI ni JWT_SECRET.
  path: require('path').join(__dirname, '..', '.env'),
});

const NODE_ENV = process.env.NODE_ENV || 'development';
const esProduccion = NODE_ENV === 'production';

const PORT = Number(process.env.PORT) || 3001;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Secreto con el que se firman y validan los JWT.
//
// En produccion es OBLIGATORIO: si no esta definido el proceso no arranca.
// Usar un valor por defecto conocido (tipo "secreto123") permitiria que
// cualquiera que lea el repositorio falsificara tokens de administrador.
//
// En desarrollo se permite un fallback para no romper el arranque local,
// pero se avisa por consola.
const JWT_SECRET = process.env.JWT_SECRET || (esProduccion ? null : 'jwt-secret-solo-desarrollo-no-usar-en-produccion');

// --- Validaciones de arranque -------------------------------------------------

const faltantes = [];

if (!MONGO_URI) {
  faltantes.push('MONGO_URI');
}

if (!JWT_SECRET) {
  faltantes.push('JWT_SECRET');
}

if (faltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${faltantes.join(', ')}. ` +
      'Revise el archivo .env (use .env.example como referencia).'
  );
}

if (!esProduccion && !process.env.JWT_SECRET) {
  console.warn(
    '⚠️  JWT_SECRET no esta definido: se usa el secreto de DESARROLLO. ' +
      'Defina JWT_SECRET en .env antes de desplegar.'
  );
}

// --------------------------------------------------------------------------------

module.exports = {
  NODE_ENV,
  esProduccion,
  PORT,
  MONGO_URI,
  JWT_SECRET,
  CLIENT_ORIGIN,
};
