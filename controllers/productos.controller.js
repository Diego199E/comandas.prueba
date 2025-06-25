const Producto = require('../models/producto.model');

const obtenerProductos = async (req, res) => {
    try {
        const productos = await Producto.find();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener los productos', error });
    }
};

const agregarProductos = async (req, res) =>{
    try {
        const nuevoProducto = new Producto(req.body);
        const productoGuardado = await nuevoProducto.save();
        res.status(201).json(productoGuardado);
    } catch (error){
        res.status(500).json({ mensaje: 'Error al agregar el producto', error});
    }
};

const actualizarProducto = async (req, res) => {
    try {
      const productoActualizado = await Producto.findByIdAndUpdate(
        req.params.id,  // ID desde la URL
        req.body,       // Nuevos datos del producto
        { new: true }   // Retornar el producto actualizado
      );
  
      if (!productoActualizado) {
        return res.status(404).json({ mensaje: 'Producto no encontrado' });
      }
  
      res.json(productoActualizado);
    } catch (error) {
      res.status(400).json({ mensaje: 'Error al actualizar el Producto', error });
    }
  };
  
  const eliminarProducto = async (req, res) => {
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
    obtenerProductos,
    agregarProductos,
    actualizarProducto,
    eliminarProducto,
};