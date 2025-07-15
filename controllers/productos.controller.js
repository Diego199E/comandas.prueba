import Inventario from "../models/ingrediente.model.js";
import Producto from "../models/producto.model.js";

// Crear producto
export const crearProducto = async (req, res) => {
  try {
    const { nombre, ingredientesUsados } = req.body;
    const producto = new Producto({
      nombre,
      ingredientesUsados,
      empresa: req.usuario.empresa,
    });
    await producto.save();

    // Buscar de nuevo el producto con populate para devolver ingredientes completos
    const productoConIngredientes = await Producto.findById(producto._id).populate("ingredientesUsados.ingrediente");

    res.status(201).json(productoConIngredientes);
  } catch (error) {
    res.status(500).json({ error: "Error al crear producto" });
  }
};


// Obtener productos
export const obtenerProductos = async (req, res) => {
  try {
    const productos = await Producto.find({ empresa: req.usuario.empresa }).populate("ingredientesUsados.ingrediente");
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

// Actualizar producto
export const actualizarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findOneAndUpdate(
      { _id: id, empresa: req.usuario.empresa },
      req.body,
      { new: true }
    ).populate("ingredientesUsados.ingrediente");;
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar producto" });
  }
};

// Eliminar producto
export const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    await Producto.findOneAndDelete({ _id: id, empresa: req.usuario.empresa });
    res.json({ mensaje: "Producto eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar producto" });
  }
};
