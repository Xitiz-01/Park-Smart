import test from 'node:test';
import assert from 'node:assert/strict';
import { advisoriesFrom, evaluate } from './audit-prod-deps.mjs';

const report = {
  vulnerabilities: {
    'better-auth': {
      via: [
        '@better-auth/drizzle-adapter',
        { name: 'better-auth', severity: 'critical', title: 'OAuth state', url: 'https://github.com/advisories/GHSA-aaaa' },
        { name: 'better-auth', severity: 'low', title: 'Rate limit', url: 'https://github.com/advisories/GHSA-low1' },
      ],
    },
    axios: { via: [{ name: 'axios', severity: 'high', title: 'SSRF', url: 'https://github.com/advisories/GHSA-bbbb' }] },
  },
};
const today = new Date('2026-11-01T12:00:00Z');

test('collects each advisory once with its own severity', () => {
  assert.deepEqual(
    advisoriesFrom(report).map((a) => `${a.id}:${a.severity}`),
    ['GHSA-aaaa:critical', 'GHSA-low1:low', 'GHSA-bbbb:high'],
  );
});

test('high and critical advisories block unless allow-listed; low ones never block', () => {
  const allowlist = [{ id: 'GHSA-aaaa', package: 'better-auth', reason: 'unused path', expires: '2026-12-31' }];
  const { blocking, allowed } = evaluate(advisoriesFrom(report), allowlist, today);
  assert.deepEqual(blocking.map((a) => a.id), ['GHSA-bbbb']);
  assert.deepEqual(allowed.map((a) => a.id), ['GHSA-aaaa']);
});

test('an expired or undated allow-list entry blocks again', () => {
  const expired = evaluate(advisoriesFrom(report), [{ id: 'GHSA-aaaa', expires: '2026-10-31' }], today);
  assert.match(expired.blocking.find((a) => a.id === 'GHSA-aaaa').why, /expired on 2026-10-31/);
  const undated = evaluate(advisoriesFrom(report), [{ id: 'GHSA-aaaa' }], today);
  assert.match(undated.blocking.find((a) => a.id === 'GHSA-aaaa').why, /no valid expiry/);
});

test('entries for advisories that are no longer reported are flagged as stale', () => {
  const { stale } = evaluate(advisoriesFrom(report), [{ id: 'GHSA-gone', expires: '2026-12-31' }], today);
  assert.deepEqual(stale.map((e) => e.id), ['GHSA-gone']);
});
