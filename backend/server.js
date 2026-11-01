const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { getConfig } = require('./src/config/env');

const config = getConfig();
const { createApp } = require('./src/app');
const { authenticateSocket } = require('./middleware/authMiddleware');

const { allowedOrigins } = config;
const app = createApp({ allowedOrigins });
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});
app.set('io', io);

io.use(authenticateSocket);
io.on('connection', (socket) => {
  socket.emit('socket:connected', { connected: true });
});

if (require.main === module) {
  connectDB().then(() => {
    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  });
}

module.exports = { app, server };
