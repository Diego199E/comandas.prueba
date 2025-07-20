const Comanda = require("../models/comanda.model");
const Producto = require("../models/producto.model");
const Ingrediente = require("../models/ingrediente.model");

const descontarIngredientesComanda = async (comandaId) => {
  try {
    const comanda = await Comanda.findById(comandaId);
    if (!comanda || comanda.estado !== true) {
      console.log("Comanda no encontrada o no está completada.");
      return;
    }

    for (const platillo of comanda.platillos) {
      for (const nombreProducto of platillo.productos) {
        const producto = await Producto.findOne({
          nombre: nombreProducto,
          empresa: comanda.empresa
        }).populate("ingredientesUsados.ingrediente");

        if (!producto) {
          console.log(`Producto no encontrado: ${nombreProducto}`);
          continue;
        }

        for (const uso of producto.ingredientesUsados) {
          const ingrediente = uso.ingrediente;
          const cantidadDescontar = uso.cantidadUsada;

          ingrediente.cantidad -= cantidadDescontar;

          if (ingrediente.cantidad < 5) {
            console.warn(`⚠️ Ingrediente casi agotado: ${ingrediente.nombre} (${ingrediente.cantidad} ${ingrediente.unidad})`);
          }

          await ingrediente.save();
        }
      }
    }

    console.log(`Ingredientes descontados para comanda ${comandaId}`);
  } catch (error) {
    console.error("Error al descontar ingredientes:", error);
  }
};

module.exports = { descontarIngredientesComanda };
