// chromeApi.js — thin wrapper so the popup components stay free of
// chrome.* boilerplate.

export function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

export async function getSettings() {
  return sendMessage({ type: 'GET_SETTINGS' });
}

export async function getStats() {
  const { stats = {} } = await chrome.storage.local.get('stats');
  return {
    drowsyAlerts: stats.drowsyAlerts || 0,
    sessionsToday: stats.sessionsToday || 0,
  };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function onStorageChange(callback) {
  const listener = (changes, area) => {
    if (area === 'local') callback(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
