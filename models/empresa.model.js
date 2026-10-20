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
  // usaIva: true  -> la empresa aplica IVA del 19%.
  //         false -> aplica el INC del 8% (regimen habitual de los
  //                   restaurantes en Colombia, Ley 2277 de 2023).
  // Por eso el valor por defecto es false: un restaurante aplica INC.
  // ANTES el default era true, lo que hacia que los recibos se calcularan
  // con 19% mientras el texto legal del comprobante hablaba de INC 8%.
  usaIva: {
    type: Boolean,
    default: false
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
