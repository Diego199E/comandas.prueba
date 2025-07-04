const express = require('express');
const router = express.Router();
const { registrarEmpresa, eliminarEmpresa, getEmpresas, actualizarEmpresa } = require('../controllers/empresa.controller');


router.get("/", getEmpresas);
router.post('/', registrarEmpresa);
router.put('/:id', actualizarEmpresa);
router.delete('/:id', eliminarEmpresa)

module.exports = router;
