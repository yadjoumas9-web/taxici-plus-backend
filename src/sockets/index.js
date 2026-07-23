const { verifyToken } = require('../utils/jwt');

function initSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentification requise.'));
      const payload = verifyToken(token);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('Token invalide.'));
    }
  });

  io.on('connection', (socket) => {
    const room = `${socket.user.role}:${socket.user.id}`;
    socket.join(room);
    console.log(`[Socket] Connexion : ${room}`);

    socket.on('driver:location', ({ lat, lng, rideId }) => {
      if (socket.user.role !== 'driver') return;
      if (rideId) {
        socket.to(`ride:${rideId}`).emit('driver:location_update', { lat, lng });
      }
    });

    socket.on('ride:join', (rideId) => {
      socket.join(`ride:${rideId}`);
    });
    socket.on('ride:leave', (rideId) => {
      socket.leave(`ride:${rideId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Déconnexion : ${room}`);
    });
  });
}

module.exports = { initSockets };
