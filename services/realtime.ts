import { API_BASE } from './apiClient';

type MessageHandler = (payload: any) => void;

const handlersByType: Record<string, Set<MessageHandler>> = {};
let ws: WebSocket | null = null;
let reconnectTimer: any = null;
let failureCount = 0;
let pollIntervalId: any = null;
const MAX_FAILURES_BEFORE_POLL = 2;
const POLL_INTERVAL_MS = 5000;

function wsUrlFromApiBase(base: string) {
  try {
    const url = new URL(base.startsWith('http') ? base : `https://${base}`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    return url.toString();
  } catch (err) {
    // fallback
    if (base.startsWith('https')) return base.replace(/^https/, 'wss') + '/ws';
    if (base.startsWith('http')) return base.replace(/^http/, 'ws') + '/ws';
    return `ws://${base}/ws`;
  }
}

function connect() {
  if (ws) return;
  const url = wsUrlFromApiBase(API_BASE);
  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.warn('Realtime: ws connect failed', err, url);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('Realtime: websocket open', url);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // reset failure counter and stop fallback polling if any
    failureCount = 0;
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const type = msg.type;
      const payload = msg.payload;
      if (type && handlersByType[type]) {
        handlersByType[type].forEach((h) => {
          try { h(payload); } catch (e) { /* ignore */ }
        });
      }
    } catch (err) {
      // ignore
    }
  };

  ws.onclose = () => {
    ws = null;
    failureCount += 1;
    if (failureCount >= MAX_FAILURES_BEFORE_POLL) {
      startFallbackPolling();
    } else {
      scheduleReconnect();
    }
  };

  ws.onerror = (err) => {
    console.warn('Realtime: ws error', err, url);
    // will trigger onclose; increment failure count here as well
    failureCount += 1;
    if (failureCount >= MAX_FAILURES_BEFORE_POLL) {
      startFallbackPolling();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

function startFallbackPolling() {
  if (pollIntervalId) return;
  console.warn('Realtime: starting fallback polling');
  // Call all registered handlers periodically with a fallback marker so
  // handlers can re-fetch their data when websocket is not available.
  const invokeAll = () => {
    Object.keys(handlersByType).forEach((type) => {
      handlersByType[type].forEach((h) => {
        try { h({ _realtimeFallback: true, type }); } catch (e) { /* ignore */ }
      });
    });
  };

  // immediate invocation
  invokeAll();

  pollIntervalId = setInterval(invokeAll, POLL_INTERVAL_MS);
}

// Allow manual immediate poke (used after submitting a session)
export function triggerImmediatePoll() {
  Object.keys(handlersByType).forEach((type) => {
    handlersByType[type].forEach((h) => {
      try { h({ _realtimeFallback: true, type, _manual: true }); } catch (e) { /* ignore */ }
    });
  });
}

export function subscribe(type: string, handler: MessageHandler) {
  if (!handlersByType[type]) handlersByType[type] = new Set();
  handlersByType[type].add(handler);
  connect();
  return () => unsubscribe(type, handler);
}

export function unsubscribe(type: string, handler: MessageHandler) {
  if (!handlersByType[type]) return;
  handlersByType[type].delete(handler);
}

export default { subscribe, unsubscribe, triggerImmediatePoll };
