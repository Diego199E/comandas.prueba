const mongoose = require("mongoose");

//Modelo de comandas
const comandasSchema = new mongoose.Schema({
    mesa: {type: String, required: true},
    platillos: [
        {
            nombre: { type: String, required: true},
            productos: { type: [String], required: true}
        }
    ],
    estado: {type: Boolean, default: false},
    hora: {type: Date, default: Date.now},
} , {
    collection: 'comandas'
});

module.exports = mongoose.model("Comanda", comandasSchema)

