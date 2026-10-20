const mongoose = require('mongoose');


// Modelo de Usuario
const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: {type: String, required: true},
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Roles del sistema:
  //   Admin  ->_duenio del restaurante_: panel completo, menu, productos,
  //             inventario, usuarios y reportes.
  //   Mesero ->_toma el pedido y lo envia a cocina_.
  //   Cocina ->_ve las comandas entrantes y cambia su estado_.
  // "Vendedor" era un residuo de una plantilla de POS: no aplica a un
  // restaurante y fue migrado a "Mesero" (scripts/migrar-roles.js).
  rol: { type: String, enum: ['Admin', 'Mesero', 'Cocina'], default: 'Mesero', required: true},
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
