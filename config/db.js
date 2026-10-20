// config/db.js
// Conexion a mongoose.
const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conexion a MongoDB establecida');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1); // Detiene el servidor si no conecta
  }
};

module.exports = connectDB;
