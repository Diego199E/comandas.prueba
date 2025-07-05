const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nit: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  razonSocial: {
    type: String,
    required: true,
    trim: true
  },
  pagoRealizado: {
    type: Boolean,
    default: false
  },
  activa: {
    type: Boolean,
    default: true
  },
  usaIva: { type: Boolean, default: true },

}, { timestamps: true });

module.exports = mongoose.model('Empresa', empresaSchema);
