const mongoose = require('mongoose');

const platoMenuSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  productos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
  ],
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('PlatoMenu', platoMenuSchema);
