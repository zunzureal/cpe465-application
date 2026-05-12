/**
 * Single-file mock CPM / IoT listener for demos.
 * Run: npm run mock-device
 * Then start a therapy session from the app — payloads appear here in color.
 */

const http = require('http');

const PORT = Number(process.env.MOCK_DEVICE_PORT || 3000);

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function logStartSession(body) {
  console.log('\n' + BOLD + GREEN + '╔══════════════════════════════════════════╗' + RESET);
  console.log(BOLD + GREEN + '║  POST /api/start-session  ✓ RECEIVED      ║' + RESET);
  console.log(GREEN + '╚══════════════════════════════════════════╝' + RESET);

  const angleFlex = body.angleFlexion ?? body.angle ?? '—';
  const angleExt = body.angleExtension ?? '—';
  const speed = body.speed ?? '—';
  const force = body.forceN ?? body.force ?? '—';
  const duration = body.durationMinutes ?? '—';

  console.log(DIM + '  Parameters:' + RESET);
  console.log(CYAN + '    Angle (flexion)' + RESET + ' : ' + BOLD + angleFlex + '°' + RESET);
  console.log(CYAN + '    Angle (extension)' + RESET + ' : ' + BOLD + angleExt + '°' + RESET);
  console.log(CYAN + '    Speed' + RESET + '           : ' + BOLD + speed + RESET);
  console.log(CYAN + '    Force' + RESET + '           : ' + BOLD + force + ' N' + RESET);
  console.log(CYAN + '    Duration' + RESET + '        : ' + BOLD + duration + ' min' + RESET);
  if (body.isManualMode != null) {
    console.log(YELLOW + '    Manual mode' + RESET + '     : ' + body.isManualMode);
  }
  if (body.clientTimestamp) {
    console.log(DIM + '    clientTimestamp : ' + body.clientTimestamp + RESET);
  }
  console.log(DIM + '\n  Full JSON:' + RESET);
  console.log(JSON.stringify(body, null, 2));
  console.log('');
}

function logEmergencyStop(body) {
  console.log('\n' + BOLD + RED + '╔══════════════════════════════════════════╗' + RESET);
  console.log(BOLD + RED + '║  POST /api/emergency-stop  ⚠ EMERGENCY   ║' + RESET);
  console.log(RED + '╚══════════════════════════════════════════╝' + RESET);

  console.log(DIM + '  Payload:' + RESET);
  if (body.timeLeftSeconds != null) {
    console.log(CYAN + '    timeLeft (s)' + RESET + '    : ' + BOLD + body.timeLeftSeconds + RESET);
  }
  if (body.targetFlexion != null) {
    console.log(CYAN + '    Target angle' + RESET + '    : ' + BOLD + body.targetFlexion + '°' + RESET);
  }
  if (body.targetForceN != null) {
    console.log(CYAN + '    Target force' + RESET + '    : ' + BOLD + body.targetForceN + ' N' + RESET);
  }
  console.log(DIM + '\n  Full JSON:' + RESET);
  console.log(JSON.stringify(body, null, 2));
  console.log('');
}

function logLiveFrame(colorCode, endpoint, body) {
  console.log('\n' + BOLD + colorCode + '╔══════════════════════════════════════════╗' + RESET);
  console.log(BOLD + colorCode + '║  POST ' + endpoint.padEnd(25) + ' ║' + RESET);
  console.log(colorCode + '╚══════════════════════════════════════════╝' + RESET);
  if (body.sessionState != null) {
    console.log(YELLOW + '    sessionState' + RESET + '    : ' + BOLD + body.sessionState + RESET);
  }
  if (body.action != null) {
    console.log(DIM + '    action' + RESET + '          : ' + body.action);
  }
  if (body.kind != null) {
    console.log(DIM + '    kind' + RESET + '            : ' + body.kind);
  }
  if (body.timeLeftSeconds != null) {
    console.log(CYAN + '    timeLeft (s)' + RESET + '    : ' + BOLD + body.timeLeftSeconds + RESET);
  }
  if (body.durationMinutes != null) {
    console.log(CYAN + '    duration (min)' + RESET + '  : ' + BOLD + body.durationMinutes + RESET);
  }
  const af = body.angleFlexion ?? body.targetFlexion;
  const ae = body.angleExtension ?? body.targetExtension;
  if (af != null) console.log(CYAN + '    Angle flexion' + RESET + '   : ' + BOLD + af + '°' + RESET);
  if (ae != null) console.log(CYAN + '    Angle extension' + RESET + ' : ' + BOLD + ae + '°' + RESET);
  if (body.speed != null) console.log(CYAN + '    Speed' + RESET + '           : ' + BOLD + body.speed + RESET);
  const f = body.forceN ?? body.targetForceN;
  if (f != null) console.log(CYAN + '    Force' + RESET + '           : ' + BOLD + f + ' N' + RESET);
  if (body.isManualMode != null) console.log(DIM + '    manualMode      : ' + body.isManualMode + RESET);
  if (body.clientTimestamp) console.log(DIM + '    clientTimestamp : ' + body.clientTimestamp + RESET);
  console.log(DIM + '\n  Full JSON:' + RESET);
  console.log(JSON.stringify(body, null, 2));
  console.log('');
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed', path: req.url });
    return;
  }

  const url = (req.url || '').split('?')[0];

  try {
    const body = await readBody(req);

    if (url === '/api/start-session') {
      logStartSession(body);
      sendJson(res, 200, { ok: true, endpoint: 'start-session' });
      return;
    }

    if (url === '/api/emergency-stop') {
      logEmergencyStop(body);
      sendJson(res, 200, { ok: true, endpoint: 'emergency-stop' });
      return;
    }

    if (url === '/api/session-pause') {
      logLiveFrame(MAGENTA, '/api/session-pause', body);
      sendJson(res, 200, { ok: true, endpoint: 'session-pause' });
      return;
    }

    if (url === '/api/session-resume') {
      logLiveFrame(GREEN, '/api/session-resume', body);
      sendJson(res, 200, { ok: true, endpoint: 'session-resume' });
      return;
    }

    if (url === '/api/session-restart') {
      logLiveFrame(YELLOW, '/api/session-restart', body);
      sendJson(res, 200, { ok: true, endpoint: 'session-restart' });
      return;
    }

    if (url === '/api/session-complete') {
      logLiveFrame(BLUE, '/api/session-complete', body);
      sendJson(res, 200, { ok: true, endpoint: 'session-complete' });
      return;
    }

    if (url === '/api/session-params') {
      logLiveFrame(CYAN, '/api/session-params', body);
      sendJson(res, 200, { ok: true, endpoint: 'session-params' });
      return;
    }

    sendJson(res, 404, { error: 'Not found', path: url });
  } catch (err) {
    console.error(RED + 'Invalid JSON body' + RESET, err.message);
    sendJson(res, 400, { error: 'Invalid JSON', detail: String(err.message) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    GREEN +
      BOLD +
      `\n  Mock device server listening on http://localhost:${PORT}` +
      RESET
  );
  console.log(DIM + '  POST /api/start-session' + RESET);
  console.log(DIM + '  POST /api/session-pause | /api/session-resume' + RESET);
  console.log(DIM + '  POST /api/session-restart | /api/session-complete' + RESET);
  console.log(DIM + '  POST /api/session-params | /api/emergency-stop\n' + RESET);
});
