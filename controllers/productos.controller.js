// controllers/productos.controller.js
const Producto = require('../models/producto.model');

const { filtroEmpresa, empresaIdDe } = require('../utils/scope');
const { soloCampos } = require('../utils/campos');

// Campos que el cliente puede escribir de un producto.
// 'empresa' y '_id' quedan fuera: son del servidor.
const CAMPOS_PRODUCTO = ['nombre', 'ingredientesUsados'];

// Crear producto
const crearProducto = async (req, res) => {
  try {
    const { nombre, ingredientesUsados } = soloCampos(req.body, CAMPOS_PRODUCTO);

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
    }

    const producto = new Producto({
      nombre,
      ingredientesUsados,
      empresa: empresaIdDe(req),
    });
    await producto.save();

    // Buscar de nuevo el producto con populate para devolver ingredientes completos
    const productoConIngredientes = await Producto.findById(producto._id).populate(
      'ingredientesUsados.ingrediente'
    );

    res.status(201).json(productoConIngredientes);
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// Obtener productos
const obtenerProductos = async (req, res) => {
  try {
    const productos = await Producto.find(filtroEmpresa(req)).populate(
      'ingredientesUsados.ingrediente'
    );
    res.json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// Actualizar producto
const actualizarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = soloCampos(req.body, CAMPOS_PRODUCTO);

    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // El filtro por empresa impide modificar productos de otra empresa.
    const producto = await Producto.findOneAndUpdate(
      filtroEmpresa(req, { _id: id }),
      datos,
      { new: true }
    ).populate('ingredientesUsados.ingrediente');

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// Eliminar producto
const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findOneAndDelete(filtroEmpresa(req, { _id: id }));

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

module.exports = {
  crearProducto,
  obtenerProductos,
  actualizarProducto,
  eliminarProducto,
};
