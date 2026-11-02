const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const request = require('supertest');

const { createApp } = require('../src/app');
const { parseEnv } = require('../src/config/env');
const { createLogger } = require('../src/platform/logger');
const { createShutdown, installProcessHandlers } = require('../src/platform/lifecycle');
const { connectWithRetry } = require('../src/platform/db');

const silent = createLogger({ level: 'silent' });
const appWithChecks = (healthChecks) => createApp({ config: parseEnv({ NODE_ENV: 'test' }), logger: silent, healthChecks });

test('liveness answers without touching dependencies', async () => {
  const app = appWithChecks({ mongo: async () => { throw new Error('should not be called'); } });
  const response = await request(app).get('/health/live');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('readiness reports each dependency as up or down, and 503 when any is down', async () => {
  const ready = await request(appWithChecks({ mongo: async () => true })).get('/health/ready');
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: 'ok', checks: { mongo: 'up' } });

  const down = await request(appWithChecks({ mongo: async () => false, other: async () => { throw new Error('mongodb://user:secret@db'); } })).get('/health/ready');
  assert.equal(down.status, 503);
  assert.deepEqual(down.body, { status: 'unavailable', checks: { mongo: 'down', other: 'down' } });
  assert.equal(JSON.stringify(down.body).includes('secret'), false, 'no internals leak');
});

const fakeServer = () => {
  const server = { listening: true, events: [] };
  server.close = (callback) => { server.events.push('server.close'); server.listening = false; setImmediate(callback); };
  server.closeIdleConnections = () => server.events.push('server.closeIdle');
  return server;
};

test('shutdown stops the server, then Socket.IO, then each dependency, once', async () => {
  const server = fakeServer();
  const order = server.events;
  const exits = [];
  const shutdown = createShutdown({
    server,
    io: { close: (callback) => { order.push('io.close'); callback(); } },
    closers: [
      { name: 'mongodb', close: async () => order.push('mongodb') },
      { name: 'auth', close: async () => order.push('auth') },
    ],
    logger: silent,
    exit: (code) => exits.push(code),
  });
  const first = shutdown('SIGTERM');
  const second = shutdown('SIGINT');
  assert.equal(first, second, 'a second signal joins the shutdown already running');
  await first;
  assert.deepEqual(order, ['server.close', 'server.closeIdle', 'io.close', 'mongodb', 'auth']);
  assert.deepEqual(exits, [0]);
});

test('a dependency that fails to close still lets the others close, and exits 1', async () => {
  const closed = [];
  const exits = [];
  const shutdown = createShutdown({
    server: fakeServer(),
    closers: [
      { name: 'mongodb', close: async () => { throw new Error('already closed'); } },
      { name: 'auth', close: async () => closed.push('auth') },
    ],
    logger: silent,
    exit: (code) => exits.push(code),
  });
  await shutdown('SIGTERM');
  assert.deepEqual(closed, ['auth']);
  assert.deepEqual(exits, [1]);
});

test('shutdown that hangs is forced to exit 1 after the timeout', async () => {
  const exits = [];
  const shutdown = createShutdown({
    server: fakeServer(),
    closers: [{ name: 'stuck', close: () => new Promise(() => {}) }],
    logger: silent,
    timeoutMs: 20,
    exit: (code) => exits.push(code),
  });
  shutdown('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(exits, [1]);
});

test('signals shut down cleanly; unhandled errors shut down with exit code 1', () => {
  const target = new EventEmitter();
  const calls = [];
  installProcessHandlers({ shutdown: (reason, code) => calls.push([reason, code]), logger: silent, target });
  target.emit('SIGTERM');
  target.emit('SIGINT');
  target.emit('unhandledRejection', new Error('nobody caught me'));
  target.emit('uncaughtException', new Error('boom'));
  assert.deepEqual(calls, [['SIGTERM', 0], ['SIGINT', 0], ['unhandledRejection', 1], ['uncaughtException', 1]]);
});

test('connections are retried with growing delays, then give up', async () => {
  const delays = [];
  let calls = 0;
  const connected = await connectWithRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('ECONNREFUSED');
    return 'connected';
  }, { logger: silent, wait: async (ms) => delays.push(ms) });
  assert.equal(connected, 'connected');
  assert.deepEqual(delays, [500, 1000]);

  const capped = [];
  await assert.rejects(
    connectWithRetry(async () => { throw new Error('down'); }, { attempts: 6, maxDelayMs: 3000, logger: silent, wait: async (ms) => capped.push(ms) }),
    /down/,
  );
  assert.deepEqual(capped, [500, 1000, 2000, 3000, 3000]);
});
