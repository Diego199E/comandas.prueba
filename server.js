const app = require('./app');
const connectDB = require('./config/db');
const PORT = process.env.PORT || 3001;

require('dotenv').config(); // Lee el archivo .env

connectDB(); // Conecta a MongoDB

app.listen(PORT,'0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
