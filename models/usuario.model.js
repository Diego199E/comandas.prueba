const mongoose = require('mongoose');


// Modelo de Usuario
const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: {type: String, required: true},
  correo: { type: String, required: true, unique: true },
  rol: { type: String, enum: ['Admin', 'Vendedor'], default: 'Vendedor', required: true},
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true
  },
  contraseña: { type: String, required: true },
}, { timestamps: true,
     collection: 'usuarios'
   });

module.exports = mongoose.model('Usuario', usuarioSchema);
