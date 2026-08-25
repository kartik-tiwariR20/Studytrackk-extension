// offscreen.js — runs inside the invisible offscreen document.
// Ports the logic of the original eye_detection.py: webcam -> face
// landmarks -> Eye Aspect Ratio -> "eyes closed for N seconds?" -> alarm.
//
// Nothing here is ever rendered to the user. No frame, landmark, or video
// byte leaves this context — it's read, measured, and discarded every tick.

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { averageEar } from '../lib/ear.js';

const video = document.getElementById('cam');
const canvas = document.getElementById('frame');
const ctx = canvas.getContext('2d');
const alarmEl = document.getElementById('alarm');

let faceLandmarker = null;
let stream = null;
let rafId = null;
let running = false;

let settings = {
  earThreshold: 0.21,
  closedEyeSeconds: 2.5,
  alarmVolume: 0.9,
};

let closedSinceTs = null;
let alarmPlaying = false;

const DEFAULT_ALARM_URL = chrome.runtime.getURL('sounds/wake_up.mp3');

async function loadCustomAlarmIfAny() {
  const { customAlarmDataUrl } = await chrome.storage.local.get('customAlarmDataUrl');
  alarmEl.src = customAlarmDataUrl || DEFAULT_ALARM_URL;
}

async function initLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    chrome.runtime.getURL('wasm')
  );
  // CPU delegate is slower than GPU but far more reliable inside a hidden
  // offscreen document — some machines/drivers don't expose a working
  // WebGL context there, which makes GPU delegate fail silently.
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: chrome.runtime.getURL('models/face_landmarker.task'),
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
}

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 480, height: 360, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  canvas.width = video.videoWidth || 480;
  canvas.height = video.videoHeight || 360;
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

function playAlarm() {
  if (alarmPlaying) return;
  alarmEl.volume = settings.alarmVolume;
  alarmEl.currentTime = 0;
  alarmEl.play().catch(() => {});
  alarmPlaying = true;
  chrome.runtime.sendMessage({ type: 'DROWSINESS_DETECTED', earAvg: lastEar });
}

function stopAlarm() {
  if (!alarmPlaying) return;
  alarmEl.pause();
  alarmEl.currentTime = 0;
  alarmPlaying = false;
}

let lastEar = null;

function tick() {
  if (!running) return;

  if (video.readyState >= 2) {
    const nowMs = performance.now();
    const result = faceLandmarker.detectForVideo(video, nowMs);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const ear = averageEar(result.faceLandmarks[0]);
      lastEar = ear;

      if (ear < settings.earThreshold) {
        if (closedSinceTs === null) closedSinceTs = nowMs;
        const closedFor = (nowMs - closedSinceTs) / 1000;
        if (closedFor >= settings.closedEyeSeconds) {
          playAlarm();
        }
      } else {
        closedSinceTs = null;
        stopAlarm();
      }

      chrome.runtime.sendMessage({
        type: 'EAR_UPDATE',
        ear,
        eyesClosed: ear < settings.earThreshold,
      });
    } else {
      // No face in frame — don't alarm on absence, just reset the timer.
      closedSinceTs = null;
    }
  }

  rafId = requestAnimationFrame(tick);
}

async function start(newSettings) {
  if (running) return;
  settings = { ...settings, ...newSettings };
  try {
    await loadCustomAlarmIfAny();
    if (!faceLandmarker) await initLandmarker();
    await startCamera();
    running = true;
    closedSinceTs = null;
    tick();
  } catch (err) {
    running = false;
    stopCamera();
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_ERROR',
      message:
        err.name === 'NotAllowedError' || err.name === 'NotFoundError'
          ? 'Camera access was blocked or no camera was found.'
          : `Couldn't start monitoring: ${err.message}`,
    });
  }
}

function stop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  stopAlarm();
  stopCamera();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OFFSCREEN_START') {
    start(message.settings);
  } else if (message.type === 'OFFSCREEN_STOP') {
    stop();
  } else if (message.type === 'OFFSCREEN_SETTINGS') {
    settings = { ...settings, ...message.settings };
    if (message.settings.customAlarmDataUrl !== undefined) {
      alarmEl.src = message.settings.customAlarmDataUrl || DEFAULT_ALARM_URL;
    }
  } else if (message.type === 'SNOOZE_ALARM') {
    stopAlarm();
    closedSinceTs = null;
  }
});
