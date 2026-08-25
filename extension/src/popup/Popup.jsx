import React, { useEffect, useRef, useState } from 'react';
import EyeIndicator from './EyeIndicator.jsx';
import { sendMessage, getSettings, getStats, fileToDataUrl, onStorageChange } from './chromeApi.js';

const SENSITIVITY_PRESETS = [
  { key: 'relaxed', label: 'Relaxed', earThreshold: 0.18, closedEyeSeconds: 3.5 },
  { key: 'balanced', label: 'Balanced', earThreshold: 0.21, closedEyeSeconds: 2.5 },
  { key: 'strict', label: 'Strict', earThreshold: 0.24, closedEyeSeconds: 1.5 },
];

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Popup() {
  const [monitoring, setMonitoring] = useState(false);
  const [sensitivityKey, setSensitivityKey] = useState('balanced');
  const [volume, setVolume] = useState(0.9);
  const [alarmName, setAlarmName] = useState(null);
  const [stats, setStats] = useState({ drowsyAlerts: 0, sessionsToday: 0 });
  const [eyeState, setEyeState] = useState('off');
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      setMonitoring(settings.monitoring);
      setVolume(settings.alarmVolume);
      setAlarmName(settings.customAlarmName);
      const match = SENSITIVITY_PRESETS.find(
        (p) => p.earThreshold === settings.earThreshold
      );
      if (match) setSensitivityKey(match.key);
      if (settings.monitoring) setEyeState('watching');
      const { sessionStartedAt } = await chrome.storage.local.get('sessionStartedAt');
      if (sessionStartedAt) setSessionStartedAt(sessionStartedAt);
      setStats(await getStats());
    })();

    const removeListener = onStorageChange((changes) => {
      if (changes.stats) setStats(getStatsFromChange(changes.stats.newValue));
    });

    const messageListener = (message) => {
      if (message.type === 'EAR_UPDATE') {
        setEyeState(message.eyesClosed ? 'alert' : 'watching');
      }
      if (message.type === 'DROWSINESS_DETECTED') {
        setEyeState('alert');
      }
      if (message.type === 'OFFSCREEN_ERROR') {
        setErrorMessage(message.message);
        setMonitoring(false);
        setEyeState('off');
        setSessionStartedAt(null);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      removeListener();
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  useEffect(() => {
    if (!monitoring || !sessionStartedAt) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed(Date.now() - sessionStartedAt), 1000);
    return () => clearInterval(id);
  }, [monitoring, sessionStartedAt]);

  function getStatsFromChange(newStats = {}) {
    return {
      drowsyAlerts: newStats.drowsyAlerts || 0,
      sessionsToday: newStats.sessionsToday || 0,
    };
  }

  async function hasCameraPermission() {
    try {
      const status = await navigator.permissions.query({ name: 'camera' });
      return status.state === 'granted';
    } catch {
      // navigator.permissions doesn't support 'camera' in every Chrome
      // build — fail safe and route through the permission tab.
      return false;
    }
  }

  async function toggleMonitoring() {
    if (monitoring) {
      await sendMessage({ type: 'STOP_MONITORING' });
      setMonitoring(false);
      setEyeState('off');
      setSessionStartedAt(null);
      return;
    }

    setErrorMessage(null);
    const granted = await hasCameraPermission();
    if (!granted) {
      chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
      setErrorMessage(
        'Camera access needed — grant it in the new tab, then press Start again.'
      );
      return;
    }

    await sendMessage({ type: 'START_MONITORING' });
    setMonitoring(true);
    setEyeState('watching');
    setSessionStartedAt(Date.now());
  }

  async function changeSensitivity(key) {
    setSensitivityKey(key);
    const preset = SENSITIVITY_PRESETS.find((p) => p.key === key);
    await sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { earThreshold: preset.earThreshold, closedEyeSeconds: preset.closedEyeSeconds },
    });
  }

  async function changeVolume(v) {
    setVolume(v);
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { alarmVolume: v } });
  }

  async function handleAlarmFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please choose an audio file (mp3, wav, etc.)');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setAlarmName(file.name);
    await sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { customAlarmName: file.name, customAlarmDataUrl: dataUrl },
    });
  }

  function resetToDefaultAlarm() {
    setAlarmName(null);
    sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { customAlarmName: null, customAlarmDataUrl: null },
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>StayAwake</h1>
            <p className="brand-sub">Study alertness monitor</p>
          </div>
        </div>
        <button
          className={`power-toggle ${monitoring ? 'is-on' : ''}`}
          onClick={toggleMonitoring}
          aria-pressed={monitoring}
        >
          <span className="power-dot" />
          {monitoring ? 'On' : 'Off'}
        </button>
      </header>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <section className="status-card">
        <EyeIndicator state={eyeState} />
        <div className="status-copy">
          <span className={`status-label status-label--${eyeState}`}>
            {eyeState === 'alert'
              ? 'Waking you up'
              : eyeState === 'watching'
              ? 'Watching for drowsiness'
              : 'Not monitoring'}
          </span>
          {monitoring && (
            <span className="status-timer">{formatDuration(elapsed)}</span>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-row">
          <span className="panel-label">Alertness sensitivity</span>
        </div>
        <div className="segmented">
          {SENSITIVITY_PRESETS.map((p) => (
            <button
              key={p.key}
              className={`segmented-option ${sensitivityKey === p.key ? 'is-active' : ''}`}
              onClick={() => changeSensitivity(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="panel-hint">
          Strict alarms sooner on shorter, lighter eye closures. Relaxed waits longer.
        </p>
      </section>

      <section className="panel">
        <div className="panel-row">
          <span className="panel-label">Wake-up sound</span>
        </div>
        <div className="sound-card">
          <span className="sound-icon" aria-hidden="true">♪</span>
          <div className="sound-info">
            <strong>{alarmName || 'Default alarm'}</strong>
            <span>{alarmName ? 'Custom upload' : 'wake_up.mp3'}</span>
          </div>
          <button className="link-button" onClick={() => fileInputRef.current?.click()}>
            Change
          </button>
          {alarmName && (
            <button className="link-button link-button--muted" onClick={resetToDefaultAlarm}>
              Reset
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={handleAlarmFile}
          />
        </div>
        <label className="volume-row">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
          />
        </label>
      </section>

      <section className="panel stats-panel">
        <div className="stat">
          <strong>{stats.sessionsToday}</strong>
          <span>Sessions today</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <strong>{stats.drowsyAlerts}</strong>
          <span>Drowsy alerts</span>
        </div>
      </section>

      <footer className="app-footer">
        Your camera feed is never shown or saved — it's read locally and discarded frame by frame.
      </footer>
    </div>
  );
}
