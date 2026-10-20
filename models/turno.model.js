const mongoose = require("mongoose");

// Turno de trabajo.
//
// Un turno agrupa las operaciones de un periodo (por ejemplo, el turno de la
// noche). Las comandas que se crean mientras el turno esta abierto quedan
// asideadas a el, de modo que al cerrar el turno se puede saber que se
// vendio y cuando.
//
// Es la unidad de cierre de caja: un restaurante necesita poder decir "en el
// turno de la noche se vendieron X".
const turnoSchema = new mongoose.Schema(
  {
    empresa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Empresa",
      required: true,
    },

    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    // Dia al que pertenece el turno (se usa para agrupar por fecha).
    fecha: {
      type: Date,
      default: Date.now,
    },

    estado: {
      type: String,
      enum: ["Abierto", "Cerrado"],
      default: "Abierto",
    },

    abiertoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
    abiertoEn: { type: Date, default: Date.now },

    cerradoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario" },
    cerradoEn: { type: Date },

    // Efectivo con el que se abrio el turno y con el que se cerro. Se
    // registran como datos, pero NO se reconcilian automaticamente: el
    // proyecto no maneja metodos de pago, asi que no se puede saber cuanto
    // del total se cobro en efectivo.
    efectivoInicial: { type: Number, default: 0 },
    efectivoFinal: { type: Number, default: 0 },

    // Fotografia de las ventas del turno, calculada al cerrarlo. Se guarda
    // para que el cierre no cambie despues si alguien edita una comanda vieja.
    totales: {
      pedidos: { type: Number, default: 0 },
      pedidosServidos: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      impuesto: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: "turnos" }
);

// Solo puede haber un turno abierto por empresa.
turnoSchema.index({ empresa: 1, estado: 1 });

module.exports = mongoose.model("Turno", turnoSchema);
