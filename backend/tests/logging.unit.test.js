const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { createLogger } = require('../src/platform/logger');
const { requestLogger, slowRequestWarning } = require('../src/platform/http/requestLogging');

const capture = () => {
  const lines = [];
  const stream = { write: (chunk) => lines.push(JSON.parse(chunk)) };
  return { lines, logger: createLogger({ level: 'info' }, stream) };
};

const appWith = (logger, ...middleware) => {
  const app = express();
  app.use(requestLogger(logger), ...middleware);
  app.get('/ping', (req, res) => {
    req.log.info({ step: 'handler' }, 'handled');
    res.json({ ok: true });
  });
  app.get('/slow', (req, res) => setTimeout(() => res.json({ ok: true }), 25));
  return app;
};

test('credentials, cookies and identity numbers are redacted', () => {
  const { lines, logger } = capture();
  logger.info({
    authorization: 'Bearer abc',
    password: 'hunter22',
    user: { email: 'a@example.com', pan: 'ABCDE1234F', accountNumber: '123456789012', token: 't' },
    req: { headers: { authorization: 'Bearer abc', cookie: 'session=1', accept: 'json' } },
  }, 'redaction check');
  const [line] = lines;
  const text = JSON.stringify(line);
  for (const secret of ['Bearer abc', 'hunter22', 'ABCDE1234F', '123456789012', 'session=1']) {
    assert.equal(text.includes(secret), false, `${secret} must not be logged`);
  }
  assert.equal(line.user.email, 'a@example.com');
  assert.equal(line.req.headers.accept, 'json');
});

test('a request id is generated, echoed and bound to every log line', async () => {
  const { lines, logger } = capture();
  const response = await request(appWith(logger)).get('/ping');
  const id = response.headers['x-request-id'];
  assert.match(id, /^[0-9a-f-]{36}$/);
  const handlerLine = lines.find((line) => line.step === 'handler');
  const completed = lines.find((line) => line.msg === 'request completed');
  assert.equal(handlerLine.req.id, id);
  assert.equal(completed.req.id, id);
  assert.equal(completed.res.statusCode, 200);
});

test("a caller's request id is kept when it's plain, replaced when it isn't", async () => {
  const { logger } = capture();
  const app = appWith(logger);
  const kept = await request(app).get('/ping').set('X-Request-Id', 'edge-7f3a.42');
  assert.equal(kept.headers['x-request-id'], 'edge-7f3a.42');
  const replaced = await request(app).get('/ping').set('X-Request-Id', 'bad id; injected');
  assert.match(replaced.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});

test('slow requests are logged as warnings with their duration', async () => {
  const { lines, logger } = capture();
  const app = appWith(logger, slowRequestWarning(10));
  await request(app).get('/ping');
  await request(app).get('/slow');
  const slow = lines.filter((line) => line.msg === 'slow request');
  assert.equal(slow.length, 1);
  assert.equal(slow[0].url, '/slow');
  assert.equal(slow[0].level, 40);
  assert.ok(slow[0].durationMs >= 10);
});
