const Producto = require('../models/plato.model');

// Obtener platos solo de la empresa del usuario
const obtenerPlatos = async (req, res) => {
  try {
    const productos = await Producto.find({ empresa: req.usuario.empresa }).populate("empresa");
    res.json(productos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los productos', error });
  }
};

const agregarPlato = async (req, res) => {
  try {
    const nuevoProducto = new Producto({
      ...req.body,
      empresa: req.usuario.empresa, // Asociar con empresa
    });
    const productoGuardado = await nuevoProducto.save();
    res.status(201).json(productoGuardado);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar el producto', error });
  }
};

const actualizarPlato = async (req, res) => {
  try {
    const productoActualizado = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!productoActualizado) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.json(productoActualizado);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al actualizar el Producto', error });
  }
};

const eliminarPlato = async (req, res) => {
  try {
    const productoEliminado = await Producto.findByIdAndDelete(req.params.id);

    if (!productoEliminado) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el Producto', error });
  }
};

module.exports = {
  obtenerPlatos,
  agregarPlato,
  actualizarPlato,
  eliminarPlato,
};
