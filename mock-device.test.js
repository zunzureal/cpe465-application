/**
 * mock-device.test.js
 * Integration test suite for mock-device.js
 *
 * Run:  node mock-device.test.js
 *
 * Uses Node.js built-in modules only (http, assert, child_process).
 * Spawns the server in a child process, runs all cases, then kills it.
 */

'use strict';

const http         = require('http');
const assert       = require('assert');
const { spawn }    = require('child_process');
const path         = require('path');

// ── Config ───────────────────────────────────────────────────────────────────
const PORT        = 19999;          // dedicated port so it never clashes
const SERVER_FILE = path.join(__dirname, 'mock-device.js');
const BASE        = `http://localhost:${PORT}`;

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const CYAN   = '\x1b[36m';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Send an HTTP request, resolve with { status, headers, body (parsed JSON) } */
function request({ method = 'POST', path: urlPath = '/', body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const raw    = body != null ? JSON.stringify(body) : null;
    const opts   = {
      hostname: 'localhost',
      port:     PORT,
      path:     urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(raw ? { 'Content-Length': Buffer.byteLength(raw) } : {}),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (raw) req.write(raw);
    req.end();
  });
}

/** Wait for the server to be ready by polling until it accepts connections */
function waitForServer(ms = 5000) {
  const deadline = Date.now() + ms;
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.request({ hostname: 'localhost', port: PORT, path: '/', method: 'POST' }, () => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) return reject(new Error('Server did not start in time'));
        setTimeout(attempt, 100);
      });
      req.end();
    }
    attempt();
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

const results = [];   // { name, passed, error }

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    process.stdout.write(`  ${GREEN}✓${RESET}  ${DIM}${name}${RESET}\n`);
  } catch (err) {
    results.push({ name, passed: false, error: err });
    process.stdout.write(`  ${RED}✗${RESET}  ${name}\n`);
    process.stdout.write(`     ${RED}${err.message}${RESET}\n`);
  }
}

// ── Test definitions ──────────────────────────────────────────────────────────

async function runTests() {
  console.log(`\n${BOLD}${CYAN}mock-device.js — Test Suite${RESET}`);
  console.log(DIM + '─'.repeat(50) + RESET + '\n');

  // ── 1. /api/start-session ─────────────────────────────────────────────────
  console.log(BOLD + '● /api/start-session' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/start-session',
      body: { angleFlexion: 45, angleExtension: 0, speed: 3, forceN: 5, durationMinutes: 20, isManualMode: false, clientTimestamp: '2025-05-16T10:00:00.000Z' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'start-session');
  });

  await test('accepts payload with alternate field names (angle / force)', async () => {
    const res = await request({
      path: '/api/start-session',
      body: { angle: 40, force: 4, speed: 2, durationMinutes: 15 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  await test('accepts payload with only required fields (no optional fields)', async () => {
    const res = await request({
      path: '/api/start-session',
      body: { angleFlexion: 30 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  await test('accepts empty body (no crash)', async () => {
    const opts = {
      hostname: 'localhost', port: PORT,
      path: '/api/start-session', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': 0 },
    };
    const res = await new Promise((resolve, reject) => {
      const req = http.request(opts, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // ── 2. /api/emergency-stop ────────────────────────────────────────────────
  console.log('\n' + BOLD + '● /api/emergency-stop' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/emergency-stop',
      body: { timeLeftSeconds: 120, targetFlexion: 45, targetForceN: 5 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'emergency-stop');
  });

  await test('works with partial payload (timeLeftSeconds only)', async () => {
    const res = await request({
      path: '/api/emergency-stop',
      body: { timeLeftSeconds: 60 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // ── 3. /api/session-pause ─────────────────────────────────────────────────
  console.log('\n' + BOLD + '● /api/session-pause' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/session-pause',
      body: { sessionState: 'paused', timeLeftSeconds: 900, durationMinutes: 20 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'session-pause');
  });

  // ── 4. /api/session-resume ────────────────────────────────────────────────
  console.log('\n' + BOLD + '● /api/session-resume' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/session-resume',
      body: { sessionState: 'running', timeLeftSeconds: 850 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'session-resume');
  });

  // ── 5. /api/session-restart ───────────────────────────────────────────────
  console.log('\n' + BOLD + '● /api/session-restart' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/session-restart',
      body: { sessionState: 'running', angleFlexion: 45, speed: 3, forceN: 5 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'session-restart');
  });

  // ── 6. /api/session-complete ──────────────────────────────────────────────
  console.log('\n' + BOLD + '● /api/session-complete' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/session-complete',
      body: { sessionState: 'complete', angleFlexion: 45, durationMinutes: 20 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'session-complete');
  });

  // ── 7. /api/session-params ────────────────────────────────────────────────
  console.log('\n' + BOLD + '● /api/session-params' + RESET);

  await test('returns HTTP 200 with { ok: true }', async () => {
    const res = await request({
      path: '/api/session-params',
      body: { angleFlexion: 50, angleExtension: 5, speed: 4, forceN: 6 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.endpoint, 'session-params');
  });

  await test('accepts targetFlexion / targetExtension field aliases', async () => {
    const res = await request({
      path: '/api/session-params',
      body: { targetFlexion: 50, targetExtension: 5, speed: 4, targetForceN: 6 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // ── 8. CORS Headers ───────────────────────────────────────────────────────
  console.log('\n' + BOLD + '● CORS' + RESET);

  await test('OPTIONS preflight returns HTTP 204', async () => {
    const res = await request({ method: 'OPTIONS', path: '/api/start-session', body: null });
    assert.strictEqual(res.status, 204);
  });

  await test('POST response includes Access-Control-Allow-Origin: *', async () => {
    const res = await request({
      path: '/api/start-session',
      body: { angleFlexion: 45 },
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], '*');
  });

  await test('POST response Content-Type is application/json', async () => {
    const res = await request({
      path: '/api/session-pause',
      body: { sessionState: 'paused' },
    });
    assert(res.headers['content-type'].includes('application/json'));
  });

  // ── 9. Error Handling ─────────────────────────────────────────────────────
  console.log('\n' + BOLD + '● Error Handling' + RESET);

  await test('GET request returns HTTP 405 Method Not Allowed', async () => {
    const res = await request({ method: 'GET', path: '/api/start-session', body: null });
    assert.strictEqual(res.status, 405);
    assert.ok(res.body.error);
  });

  await test('Unknown endpoint returns HTTP 404', async () => {
    const res = await request({ path: '/api/unknown-endpoint', body: {} });
    assert.strictEqual(res.status, 404);
    assert.ok(res.body.error);
    assert.strictEqual(res.body.path, '/api/unknown-endpoint');
  });

  await test('Malformed JSON body returns HTTP 400', async () => {
    const opts = {
      hostname: 'localhost', port: PORT,
      path: '/api/start-session', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': 7 },
    };
    const res = await new Promise((resolve, reject) => {
      const req = http.request(opts, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(d) }));
      });
      req.on('error', reject);
      req.write('{bad!!}');
      req.end();
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  await test('Root path (/) returns HTTP 404', async () => {
    const res = await request({ path: '/', body: {} });
    assert.strictEqual(res.status, 404);
  });

  // ── 10. Query-string stripping ────────────────────────────────────────────
  console.log('\n' + BOLD + '● Query-string handling' + RESET);

  await test('Query string on valid endpoint is ignored (still returns 200)', async () => {
    const res = await request({
      path: '/api/start-session?debug=1&ts=123',
      body: { angleFlexion: 45 },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // ── 11. Concurrent requests ───────────────────────────────────────────────
  console.log('\n' + BOLD + '● Concurrency' + RESET);

  await test('Handles 10 concurrent POST /api/start-session requests', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      request({ path: '/api/start-session', body: { angleFlexion: i * 5 } })
    );
    const responses = await Promise.all(promises);
    for (const res of responses) {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
    }
  });

  await test('Handles mixed concurrent requests across all endpoints', async () => {
    const endpoints = [
      '/api/start-session', '/api/session-pause', '/api/session-resume',
      '/api/session-restart', '/api/session-complete', '/api/session-params', '/api/emergency-stop',
    ];
    const responses = await Promise.all(
      endpoints.map(p => request({ path: p, body: { angleFlexion: 30 } }))
    );
    for (const res of responses) {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
    }
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // 1. Spawn the server
  const server = spawn('node', [SERVER_FILE], {
    env: { ...process.env, MOCK_DEVICE_PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'ignore'],  // suppress server output during tests
  });

  server.on('error', (err) => {
    console.error(RED + 'Failed to start mock-device.js: ' + err.message + RESET);
    process.exit(1);
  });

  // 2. Wait for server to be ready
  try {
    await waitForServer(5000);
  } catch (err) {
    console.error(RED + err.message + RESET);
    server.kill();
    process.exit(1);
  }

  // 3. Run tests
  try {
    await runTests();
  } finally {
    server.kill();
  }

  // 4. Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total  = results.length;

  console.log('\n' + DIM + '─'.repeat(50) + RESET);
  console.log(BOLD + `\nTest Results: ${GREEN}${passed} passed${RESET}` +
              (failed ? `, ${RED}${failed} failed${RESET}` : '') +
              ` ${DIM}/ ${total} total${RESET}\n`);

  if (failed > 0) {
    console.log(RED + BOLD + 'Failed tests:' + RESET);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${RED}✗${RESET} ${r.name}`);
      console.log(`    ${DIM}${r.error.message}${RESET}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log(GREEN + BOLD + '✓ All tests passed!' + RESET + '\n');
    process.exit(0);
  }
})();
