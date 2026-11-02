#!/usr/bin/env node
// Fail on high or critical advisories in production dependencies, except
// ones listed in .github/audit-allowlist.json that haven't expired yet.
//
//   node scripts/audit-prod-deps.mjs frontend backend
//
// Allow-list entries need an id (GHSA-…), the package, a reason and an
// expiry date (YYYY-MM-DD). An expired entry fails the check, so every
// accepted advisory gets looked at again.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_FILE = path.join(ROOT, '.github', 'audit-allowlist.json');

/**
 * Collect the advisories behind an `npm audit --json` report.
 * @param {object} report parsed `npm audit --json` output
 * @returns {{ id: string, package: string, severity: string, title: string }[]}
 */
export function advisoriesFrom(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities || {})) {
    for (const via of vulnerability.via || []) {
      if (typeof via !== 'object') continue;
      const id = String(via.url || '').split('/').pop() || String(via.source);
      if (!found.has(id)) {
        found.set(id, { id, package: via.name, severity: via.severity, title: via.title });
      }
    }
  }
  return [...found.values()];
}

/**
 * Split advisories into blocking, allowed and stale allow-list entries.
 * @param {ReturnType<typeof advisoriesFrom>} advisories
 * @param {{ id: string, package: string, reason: string, expires: string }[]} allowlist
 * @param {Date} today
 */
export function evaluate(advisories, allowlist, today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  const entries = new Map(allowlist.map((entry) => [entry.id, entry]));
  const blocking = [];
  const allowed = [];
  for (const advisory of advisories) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const entry = entries.get(advisory.id);
    if (!entry) blocking.push({ ...advisory, why: 'not on the allow-list' });
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires || '')) blocking.push({ ...advisory, why: 'allow-list entry has no valid expiry date' });
    else if (entry.expires < todayIso) blocking.push({ ...advisory, why: `allow-list entry expired on ${entry.expires}` });
    else allowed.push({ ...advisory, expires: entry.expires, reason: entry.reason });
  }
  const seen = new Set(advisories.map((advisory) => advisory.id));
  const stale = allowlist.filter((entry) => !seen.has(entry.id));
  return { blocking, allowed, stale };
}

function auditReport(dir) {
  try {
    return JSON.parse(execFileSync('npm', ['audit', '--omit=dev', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

function main(dirs) {
  const allowlist = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8')).advisories || [];
  const seenAnywhere = new Set();
  let failed = false;
  for (const dir of dirs) {
    const report = auditReport(path.resolve(ROOT, dir));
    if (report.error) throw new Error(`npm audit failed in ${dir}: ${report.error.summary || report.error.code}`);
    const advisories = advisoriesFrom(report);
    advisories.forEach((advisory) => seenAnywhere.add(advisory.id));
    const { blocking, allowed } = evaluate(advisories, allowlist);
    console.log(`\n${dir}: ${advisories.length} advisories, ${blocking.length} blocking, ${allowed.length} allowed`);
    for (const a of allowed) console.log(`  allowed  ${a.severity.padEnd(8)} ${a.id} ${a.package} (until ${a.expires}): ${a.reason}`);
    for (const a of blocking) console.log(`::error title=npm audit (${dir})::${a.severity} ${a.id} in ${a.package}: ${a.title} — ${a.why}`);
    failed ||= blocking.length > 0;
  }
  for (const entry of allowlist.filter((e) => !seenAnywhere.has(e.id))) {
    console.log(`::warning title=npm audit::${entry.id} (${entry.package}) is no longer reported; remove it from .github/audit-allowlist.json`);
  }
  if (failed) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2).length ? process.argv.slice(2) : ['frontend', 'backend']);
}
