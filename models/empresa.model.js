const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pagoRealizado: {
    type: Boolean,
    default: false  // false = no ha pagado, true = pagó
  },
  activa: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Empresa', empresaSchema);
