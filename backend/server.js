const http = require('http');
const { Server } = require('socket.io');
// Load the config before anything that reads it (the logger, the database
// module), so a bad environment ends with the readable list, not a stack.
const { getConfig, EnvValidationError } = require('./src/config/env');

let config;
try {
  config = getConfig();
} catch (error) {
  // No logger yet: it needs the config. Print the readable list and stop.
  if (error instanceof EnvValidationError && require.main === module) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
const { logger } = require('./src/platform/logger');
const connectDB = require('./config/db');
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
      logger.info({ port: config.port, nodeEnv: config.nodeEnv }, 'server listening');
    });
  });
}

module.exports = { app, server };
