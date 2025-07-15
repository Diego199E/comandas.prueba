const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  ingredientesUsados: [
    {
      ingrediente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ingrediente',
        required: true,
      },
      cantidadUsada: {
        type: Number,
        required: true,
        min: 1,
      },
    },
  ],
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true,
  },

}, { timestamps: true });

module.exports = mongoose.model('Producto', productoSchema);
