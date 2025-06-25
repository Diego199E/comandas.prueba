const mongoose = require('mongoose');

//Modelo de los productos
const productoSchema = new mongoose.Schema({
    nombre: {type: String, required: true },
    categoria: {type: String, required: true},
    precio: {type: Number, required: true },
    cantidad: {type: Number, required: true},
    disponible: {type: Boolean, required: true},
}, {timestamps: true,
    collection: 'productos'
});

module.exports = mongoose.model('Producto', productoSchema);