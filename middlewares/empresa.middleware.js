// middlewares/empresa.middleware.js
// Verifica que la empresa del usuario autenticado este activa y habilitada.
//
// Se aplica a las rutas operativas (menú, productos, inventario, comandas).
// NO se aplica a las rutas de "mi empresa" (/api/empresa/mi): una empresa
// inactiva debe poder entrar a ver y corregir sus propios datos.
const verificarEmpresaActiva = (req, res, next) => {
  const empresa = req.usuario?.empresa;

  if (!empresa) {
    return res.status(403).json({ mensaje: 'No se encontró la empresa del usuario' });
  }

  if (!empresa.activa || !empresa.pagoRealizado) {
    return res.status(403).json({
      mensaje: 'Tu empresa no tiene acceso al sistema. Verifica el estado del pago o activación.',
    });
  }

  next();
};

module.exports = { verificarEmpresaActiva };
