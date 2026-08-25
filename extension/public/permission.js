const btn = document.getElementById('grant-btn');
const statusEl = document.getElementById('status');
const video = document.getElementById('preview');

btn.addEventListener('click', async () => {
  btn.disabled = true;
  statusEl.textContent = 'Requesting camera…';
  statusEl.className = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    // We only needed this to trigger + record the permission grant for the
    // extension's origin. Stop the stream immediately — the hidden
    // offscreen document opens its own stream when monitoring starts.
    stream.getTracks().forEach((t) => t.stop());
    statusEl.textContent = 'Camera access granted — you can close this tab and press Start in the popup.';
    statusEl.className = 'ok';
    btn.textContent = 'Allowed';
  } catch (err) {
    statusEl.textContent =
      err.name === 'NotAllowedError'
        ? 'Camera access was blocked. Click the camera icon in the address bar to allow it, then try again.'
        : `Couldn't access the camera: ${err.message}`;
    statusEl.className = 'err';
    btn.disabled = false;
  }
});
