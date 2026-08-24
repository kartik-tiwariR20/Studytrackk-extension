# StayAwake — Eye-Tracking Study Alarm Extension

A browser extension that watches your eyes through your webcam while you study and plays a loud alarm the moment it detects you've dozed off — so you never lose hours of study time to an accidental nap.

## 💡 The Idea

We've all been there: you sit down to study, and twenty minutes later you wake up with your face on the keyboard and no idea how much time you lost. **StayAwake** solves this by using your webcam to track your eyes in real time. If your eyes stay closed longer than a set threshold (meaning you've likely fallen asleep, not just blinked), it plays a sharp alarm sound to jolt you awake.

## ✨ Features

- 🎥 **Real-time eye tracking** using your webcam, entirely in the browser
- 😴 **Drowsiness/sleep detection** based on how long your eyes stay closed
- 🔊 **Configurable alarm sound** to wake you up instantly
- ⏱️ **Adjustable sensitivity** — set how many seconds of closed eyes should trigger the alarm
- 🔒 **Privacy-first** — all processing happens locally in your browser; no video is ever uploaded or stored
- 🧩 **Works as a browser extension** — toggle it on/off from the toolbar, use it on any tab
- 🌙 **Study mode toggle** — only runs when you turn it on, so it won't randomly access your camera

## 🧠 How It Works (Concept)

1. User turns the extension on and starts a study session.
2. The extension watches the user's eyes via the webcam.
3. If the eyes stay closed for longer than a set time (meaning they've likely fallen asleep, not just blinked), it's flagged as "asleep."
4. An alarm sound plays to wake the user up.
5. The user dismisses the alarm (e.g., "I'm awake") and studying continues.

*(Exact detection method, tech stack, and file structure will be documented here once development begins.)*

## ⚙️ Configuration (Planned Settings)

- **Sensitivity** — seconds of closed eyes before the alarm triggers
- **Alarm sound** — choose from presets or upload a custom sound
- **Volume**
- **Snooze duration**

## 🔐 Permissions Required

- `camera` — to detect eye state (processed locally, never transmitted)
- `storage` — to save user preferences (sensitivity, alarm choice)

## 🗺️ Roadmap

- [ ] Basic eye-closed detection working
- [ ] Popup UI with Start/Stop toggle
- [ ] Configurable sensitivity & alarm sound
- [ ] Session stats (e.g., "You dozed off 3 times today")
- [ ] Dark mode UI
- [ ] Firefox support (Manifest V2/V3 compatibility)

## ⚠️ Limitations

- Requires decent lighting and a front-facing webcam for reliable detection
- Not a substitute for proper sleep — this is a productivity aid, not a medical device
- Performance depends on the device's ability to run real-time face tracking in-browser

## 📄 License

MIT (suggested — update as you prefer)

## 🤝 Contributing

This project is open for anyone to use and improve. Issues and pull requests are welcome once the repo is public.
