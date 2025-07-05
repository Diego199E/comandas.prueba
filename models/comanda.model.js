const mongoose = require("mongoose");

const comandasSchema = new mongoose.Schema({
  mesa: { type: String, required: true },
  platillos: [
    {
      nombre: { type: String, required: true },
      productos: { type: [String], required: true },
      precio: { type: Number, required: true },
    },
  ],
  estado: { type: Boolean, default: false },
  hora: { type: Date, default: Date.now },

  empresa: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },

  nitEmpresa: { type: String },
  razonSocialEmpresa: { type: String },

  // 👇 Nuevo campo para saber qué mesero creó la comanda
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
  },

  usaIva: { type: Boolean, default: true },
  
}, {
  collection: "comandas"
});

module.exports = mongoose.model("Comanda", comandasSchema);
