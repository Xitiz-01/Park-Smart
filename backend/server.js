const http = require('http');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

dotenv.config();

const { createApp } = require('./src/app');
const { authenticateSocket } = require('./middleware/authMiddleware');

const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'https://park-smart-eight.vercel.app',
  ...configuredOrigins,
].filter(Boolean))];

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

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  });
}

module.exports = { app, server };
