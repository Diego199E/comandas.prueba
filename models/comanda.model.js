// comanda.model.js
const mongoose = require("mongoose");

const comandasSchema = new mongoose.Schema({
  mesa: { type: String, required: true },
  platillos: [
    {
      nombre: { type: String, required: true },
      productos: { type: [String], required: true },
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
},
{
  collection: "comandas"
});

module.exports = mongoose.model("Comanda", comandasSchema);
