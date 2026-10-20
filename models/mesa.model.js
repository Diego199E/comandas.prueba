const mongoose = require("mongoose");

// Mesa del restaurante.
//
// Antes las mesas vivian SOLO en el estado del navegador (useState del hook
// useMesero): si el mesero recargaba la pagina o se caia la conexion, el
// pedido en curso se perdia sin dejar rastro.
//
// Una mesa guarda:
//   - su borrador: los platillos que se le estan agregando todavia (no
//     necesita enviarlos todavia),
//   - a que comanda corresponde el pedido actual,
//   - si esta libre u ocupada.
const mesaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Empresa",
      required: true,
    },

    estado: {
      type: String,
      enum: ["Libre", "Ocupada"],
      default: "Libre",
    },

    // Borrador del pedido en curso. Misma forma que los platillos de una
    // comanda, mas 'opciones' (lo que el cliente eligio de cada plato).
    platillos: [
      {
        nombre: { type: String, required: true },
        precio: { type: Number, default: 0 },
        opciones: { type: Map, of: String, default: {} },
      },
    ],

    // Comanda enviada desde esta mesa que todavia no fue servida.
    comandaActual: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comanda",
      default: null,
    },
  },
  { timestamps: true, collection: "mesas" }
);

// El numero de mesa es unico dentro de la empresa, no global.
mesaSchema.index({ empresa: 1, nombre: 1 }, { unique: true });

module.exports = mongoose.model("Mesa", mesaSchema);
