// app.js
// config/env se carga PRIMERO: es el modulo que lee el .env.
// Si se cargara despues, process.env.CLIENT_ORIGIN y JWT_SECRET estarian
// vacios en este punto.
const { CLIENT_ORIGIN, esProduccion } = require('./config/env');

const express = require('express');
const cors = require('cors');
const app = express();

// Render (y cualquier proxy) reenvia la peticion: hay que confiar en el proxy
// para que las IPs reales sean correctas.
app.set('trust proxy', 1);

// --- Middlewares basicos -------------------------------------------------------

// CORS restringido a los origenes declarados en CLIENT_ORIGIN.
// Antes era cors() abierto: cualquier sitio del mundo podia llamar la API.
const origenesPermitidos = CLIENT_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origenesPermitidos.length > 0 ? origenesPermitidos : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Cabeceras de seguridad basicas (sin dependencias externas).
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// --- Rutas ---------------------------------------------------------------------

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

// Nueva ruta de ingredientes, productos y menu
const ingredientesRoutes = require('./routes/ingredientes.routes');
app.use('/api/ingredientes', ingredientesRoutes);

const productosRoutes = require('./routes/productos.routes');
app.use('/api/productos', productosRoutes);

// Ruta de platos
const platosRoutes = require('./routes/platos.routes');
app.use('/api/platos', platosRoutes);

// Ruta de comandas
const comandasRoute = require('./routes/comandas.routes');
app.use('/api/comandas', comandasRoute);

// Ruta de menues (menú público y privado)
const menuesRoutes = require('./routes/menues.routes');
app.use('/api/menues', menuesRoutes);

// --- Manejo de errores ---------------------------------------------------------

// 404 para rutas no registradas: siempre JSON, nunca la pagina HTML por
// defecto de Express.
app.use((req, res) => {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejador central de errores: registra el detalle en consola y responde
// un JSON limpio, sin filtrar stack traces al cliente.
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado:', err);

  if (res.headersSent) return next(err);

  const esErrorDeValidacion = err.name === 'ValidationError';
  const esCast = err.name === 'CastError';
  const esDuplicado = err.code === 11000;

  if (esDuplicado) {
    return res.status(409).json({ mensaje: 'Ya existe un registro con esos datos' });
  }

  if (esErrorDeValidacion || esCast) {
    return res.status(400).json({ mensaje: 'Datos inválidos en la solicitud' });
  }

  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

module.exports = app;
