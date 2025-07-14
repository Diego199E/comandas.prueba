const mongoose = require('mongoose');

const ingredienteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  cantidad: {
    type: Number,
    required: true,
    default: 0,
  },
  unidad: {
    type: String,
    default: "unidades", // kg, litros, etc.
  },
  disponible: {
    type: Boolean,
    default: true,
  },
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
}, { timestamps: true });

// Capitalizar nombre antes de guardar
ingredienteSchema.pre('save', function (next) {
  this.nombre = this.nombre.charAt(0).toUpperCase() + this.nombre.slice(1).toLowerCase();
  next();
});

module.exports = mongoose.model('Ingrediente', ingredienteSchema);
