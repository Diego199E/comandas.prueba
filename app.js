// Importaciones
const express = require('express');
const cors = require('cors');
const app = express();

// Middlewares básicos
app.use(cors()); // Permite peticiones de otros dominios (como tu frontend)
app.use(express.json()); // Permite leer JSON desde el body de las peticiones

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Hola desde el backend con Express 🚀');
});

// Ruta de comandas
const comandasRoute = require('./routes/comandas.routes');
app.use('/api/comandas', comandasRoute);

// Ruta de autenticacion
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Ruta de usuarios
const usuariosRoutes = require('./routes/usuarios.routes');
app.use('/api/usuarios', usuariosRoutes);

//Ruta de productos
const productosRoutes = require('./routes/productos.routes');
app.use('/api/productos', productosRoutes);

module.exports = app;
