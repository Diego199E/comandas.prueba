// empresa.middleware.js
const verificarEmpresaActiva = (req, res, next) => {
    const empresa = req.usuario.empresa;
  
    if (!empresa) {
      return res.status(403).json({ mensaje: 'No se encontró la empresa del usuario' });
    }
  
    if (!empresa.activa || !empresa.pagoRealizado) {
      return res.status(403).json({
        mensaje: 'Tu empresa no tiene acceso al sistema. Verifica el estado del pago o activación.'
      });
    }
  
    next();
  };
  
  module.exports = { verificarEmpresaActiva };
  