// middlewares/rol.middleware.js
// Control de acceso por rol.
//
// Roles validos: 'Admin' | 'Mesero' | 'Cocina'  (ver models/usuario.model.js)
//
// Uso: router.post('/ruta', verificarToken, permitirRoles('Admin'), controller)
function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    // El middleware de token debe ejecutarse siempre antes que este.
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'Token requerido' });
    }

    const rolUsuario = req.usuario.rol;

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        mensaje: `Acceso denegado: se requiere uno de los roles [${rolesPermitidos.join(', ')}]`,
      });
    }

    next();
  };
}

module.exports = { permitirRoles };
