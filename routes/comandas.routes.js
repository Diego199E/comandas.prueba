const express = require('express');
const router = express.Router();
const {
    getComandas,
    crearComanda,
    completarComanda,
    eliminarComanda
} = require('../controllers/comandas.controller');

const { verificarToken } = require('../middlewares/auth.middleware');

const {verificarEmpresaActiva} = require('../middlewares/empresa.middleware');

// Protege todas las rutas con token y empresa activa
router.use(verificarToken, verificarEmpresaActiva);


// Obtener todas las comandas activas (no completadas) de la empresa
router.get('/',getComandas);

// Crear una nueva comanda asociada a la empresa del usuario
router.post('/', crearComanda);

// Marcar como completada (por ahora se usa DELETE, pero semánticamente sería mejor un PUT o PATCH)
router.patch('/:id',completarComanda);

router.delete('/:id',eliminarComanda);

module.exports = router;