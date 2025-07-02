const express = require('express');
const router = express.Router();
const { registrarEmpresa } = require('../controllers/empresa.controller');

router.post('/', registrarEmpresa);

module.exports = router;
