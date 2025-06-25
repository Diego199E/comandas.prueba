const express = require('express');
const router = express.Router();
const {
    getComandas,
    crearComanda,
    completarComanda
} = require('../controllers/comandas.controller')

router.get('/',getComandas);

router.post('/', crearComanda);

router.delete('/:id',completarComanda);

module.exports = router;