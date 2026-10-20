const mongoose = require("mongoose");

const comandasSchema = new mongoose.Schema({
  mesa: { type: String, required: true },
  platillos: [
    {
      nombre: { type: String, required: true },
      productos: { type: [String], required: true },
      // Resolucion de los productos a sus ids en el momento de crear la comanda.
      // "productos" guarda los nombres (son los que ve el cliente y los que
      // van en el recibo); "productosResueltos" guarda la referencia real al
      // Producto, para que el descuento de inventario NO dependa de texto
      // libre y no se rompa si un producto se renombra.
      // Se guarda como par {nombre, producto} (y no como un array de ids
      // aparte) para que la correspondencia con "productos" sea exacta
      // aunque alguna opcion no se pueda resolver.
      productosResueltos: [
        {
          nombre: { type: String },
          producto: { type: mongoose.Schema.Types.ObjectId, ref: "Producto" },
        },
      ],
      // true cuando el plato se mando SIN opciones elegidas y el sistema
      // asumio la composicion por defecto del plato (todo su contenido).
      // Queda registrado para que el recibo refleje que se asumio, no que el
      // cliente lo pidio asi.
      productoPorDefecto: { type: Boolean, default: false },
      precio: { type: Number, required: true },
    },
  ],
  estado: { type: Boolean, default: false },
  hora: { type: Date, default: Date.now },

  // --- Estado dentro de la cocina ------------------------------------------
  // "estado" dice si la comanda fue servida (y por tanto si el stock ya se
  // descontó). "estadoCocina" dice en qué punto del proceso está en cocina.
  // Son dos cosas distintas: una comanda puede estar "Lista" en cocina y
  // todavía no haber llegado a la mesa.
  estadoCocina: {
    type: String,
    enum: ['Pendiente', 'En preparacion', 'Listo'],
    default: 'Pendiente',
  },

  // --- Control del descuento de inventario (idempotencia) -------------------
  // stockDescontado marca que el stock YA fue descontado por esta comanda.
  // Es lo que impide que un doble clic o un reintento descuente dos veces.
  // OJO: las comandas creadas antes de este campo NO lo tienen, por eso las
  // consultas usan {$ne: true} (que tambien matchea los documentos sin el
  // campo) y no {stockDescontado: false}.
  stockDescontado: { type: Boolean, default: false },
  stockDescontadoEn: { type: Date },
  // Avisos del descuento: ingredientes que quedaron en negativo, productos
  // que no se pudieron resolver, platos enviados sin productos.
  alertasStock: { type: [String], default: [] },

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

  impresa: { type: Boolean, default: false },
  
}, {
  collection: "comandas"
});

module.exports = mongoose.model("Comanda", comandasSchema);
