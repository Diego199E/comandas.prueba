const mongoose = require('mongoose');
const slugify = require('slugify');

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
  usaIva: { 
    type: Boolean, 
    default: true 
  },

  // 👇 Campo nuevo
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  }

}, { timestamps: true });

// Antes de guardar, generar el slug basado en el nombre
empresaSchema.pre('save', function (next) {
  if (!this.slug && this.nombre) {
    this.slug = slugify(this.nombre, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Empresa', empresaSchema);
