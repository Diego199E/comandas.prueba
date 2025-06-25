// funcion de roles
function permitirRoles(...rolesPermitidos) {
    return (req, res, next) => {
      const rolUsuario = req.usuario.rol; // esto viene del token
      if (!rolesPermitidos.includes(rolUsuario)) {
        return res.status(403).json({ mensaje: 'Acceso denegado: rol no autorizado' });
      }
      next();
    };
  }
  
  module.exports = { permitirRoles };
