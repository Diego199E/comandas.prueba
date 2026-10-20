// middlewares/rateLimit.js
// Limitador de peticiones en memoria, por IP y por ventana de tiempo.
//
// Se implementa aqui (en vez de usar express-rate-limit) para no sumar
// dependencias: son unas 30 lineas y la memoria se libera sola.
//
// OJO: en un servidor con varias instancias este limite es POR PROCESO. Para
// un despliegue de una sola instancia (el caso de este proyecto) es
// suficiente; con varias habria que usar un almacen compartido (Redis).

/**
 * @param {object} opciones
 * @param {number} [opciones.maximo] peticiones permitidas por ventana
 * @param {number} [opciones.ventanaMs] duracion de la ventana en ms
 * @param {string} [opciones.mensaje] mensaje de error
 */
function limitarPeticiones({ maximo = 10, ventanaMs = 60 * 1000, mensaje } = {}) {
  const contadores = new Map();

  // Limpieza periodica de las IP que ya no estan activas.
  const limpiar = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, registro] of contadores) {
      if (ahora - registro.inicio > ventanaMs) contadores.delete(clave);
    }
  }, ventanaMs);

  // .unref() evita que este temporizador mantenga vivo el proceso.
  if (typeof limpiar.unref === 'function') limpiar.unref();

  return (req, res, next) => {
    const clave = req.ip || req.socket?.remoteAddress || 'desconocido';
    const ahora = Date.now();
    const registro = contadores.get(clave);

    if (!registro || ahora - registro.inicio > ventanaMs) {
      contadores.set(clave, { inicio: ahora, peticiones: 1 });
      return next();
    }

    registro.peticiones += 1;

    if (registro.peticiones > maximo) {
      const esperaSegundos = Math.ceil((ventanaMs - (ahora - registro.inicio)) / 1000);
      res.setHeader('Retry-After', String(esperaSegundos));
      return res.status(429).json({
        mensaje: mensaje || `Demasiados intentos. Intenta de nuevo en ${esperaSegundos} segundos.`,
      });
    }

    next();
  };
}

module.exports = { limitarPeticiones };
