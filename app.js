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


// Ruta de empresa
const empresaRoutes = require('./routes/empresa.routes');
app.use('/api/empresa', empresaRoutes);

// Ruta de autenticacion
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Ruta de usuarios
const usuariosRoutes = require('./routes/usuarios.routes');
app.use('/api/usuarios', usuariosRoutes);


//Nueva ruta de ingredientes, productos y menu
const ingredientesRoutes = require('./routes/ingredientes.routes');
app.use('/api/ingredientes', ingredientesRoutes);

const productosRoutes = require('./routes/productos.routes');
app.use('/api/productos', productosRoutes);


//Ruta de platos
const platosRoutes = require('./routes/platos.routes');
app.use('/api/platos', platosRoutes);

// Ruta de comandas
const comandasRoute = require('./routes/comandas.routes');
app.use('/api/comandas', comandasRoute);

module.exports = app;
