// background.js — MV3 service worker.
// Owns the lifecycle of the hidden offscreen document (the only place the
// camera stream and face landmarker actually run) and relays messages
// between the popup UI and that offscreen document. The service worker
// itself never touches the camera or the DOM.

const OFFSCREEN_URL = 'offscreen.html';
const BACKEND_URL = 'http://127.0.0.1:5000'; // local Flask backend, see /backend

let creatingOffscreenPromise = null;

async function hasOffscreenDocument() {
  const matched = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  return matched.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }
  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification:
      'Reads the webcam locally to detect closed eyes. The video is never rendered to the user or sent anywhere.',
  });
  await creatingOffscreenPromise;
  creatingOffscreenPromise = null;
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

async function getSettings() {
  const defaults = {
    monitoring: false,
    earThreshold: 0.21,
    closedEyeSeconds: 2.5,
    alarmVolume: 0.9,
    customAlarmName: null, // filename shown in UI; audio itself lives in chrome.storage.local as base64
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

async function logSessionEvent(type, payload = {}) {
  // Fire-and-forget sync to the local backend. Never blocks the extension
  // if the backend isn't running — stats also live in chrome.storage.local
  // as the source of truth for the popup.
  try {
    await fetch(`${BACKEND_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload, ts: Date.now() }),
    });
  } catch (_err) {
    // Backend offline — that's fine, it's optional.
  }
}

async function bumpLocalStat(key, incrementBy = 1) {
  const { stats = {} } = await chrome.storage.local.get('stats');
  stats[key] = (stats[key] || 0) + incrementBy;
  await chrome.storage.local.set({ stats });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // keep the channel open for the async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'START_MONITORING': {
      const settings = await getSettings();
      await ensureOffscreenDocument();
      await chrome.storage.local.set({ monitoring: true, sessionStartedAt: Date.now() });
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', settings });
      logSessionEvent('session_start');
      return { ok: true };
    }

    case 'STOP_MONITORING': {
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
      await closeOffscreenDocument();
      await chrome.storage.local.set({ monitoring: false });
      logSessionEvent('session_stop');
      return { ok: true };
    }

    case 'UPDATE_SETTINGS': {
      await chrome.storage.local.set(message.settings);
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_SETTINGS', settings: message.settings });
      return { ok: true };
    }

    case 'DROWSINESS_DETECTED': {
      // Comes from the offscreen document. Surface a system notification
      // (in addition to the alarm sound it already plays itself) and log it.
      await bumpLocalStat('drowsyAlerts');
      logSessionEvent('drowsy_alert', { earAvg: message.earAvg });
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Wake up!',
        message: "You dozed off — I've sounded the alarm.",
        priority: 2,
      });
      return { ok: true };
    }

    case 'GET_SETTINGS': {
      return await getSettings();
    }

    default:
      return { ok: false, error: 'unknown message type' };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ monitoring: false });
});
