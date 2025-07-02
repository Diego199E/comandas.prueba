const mongoose = require('mongoose');

const platoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  contenido: [{
    categoria: { type: String, required: true },  // ej: "entrada", "bebida"
    valor: { type: String },                      // ej: "Sopa", "Jugo"
    seleccionable: { type: Boolean, default: true }
  }],
  precio: { type: Number, required: true },
  cantidad: { type: Number, required: true },
  disponible: { type: Boolean, default: true },
  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true
  }
}, {
  timestamps: true,
  collection: 'platos'
});

module.exports = mongoose.model('Plato', platoSchema);
