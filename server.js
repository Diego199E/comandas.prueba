// server.js
// IMPORTANTE: config/env se carga PRIMERO porque es el que lee el .env.
// Si se hiciera despues, process.env.PORT y process.env.JWT_SECRET todavia
// estarian vacios en este punto.
const { PORT, NODE_ENV } = require('./config/env');

const app = require('./app');
const connectDB = require('./config/db');

connectDB(); // Conecta a MongoDB

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT} (${NODE_ENV})`);
});
