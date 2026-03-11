# 🐐 GoatCitadel Mobile

> **GoatCitadel Mobile** is the sleek, operator-first companion app for [GoatCitadel](https://github.com/spurnout/GoatCitadel), bringing Mission Control directly to your Android device.

Built with React Native and Expo, this app connects to your self-hosted GoatCitadel gateway to provide real-time AI command and control on the go, without sacrificing the premium "Signal Noir" aesthetics of the desktop surface.

## 🚀 Features

- **Command Deck:** Real-time system vitals, agent heartbeat, and unread notifications at a glance.
- **Premium Chat:** Rich, mobile-optimized chat interface for `Chat`, `Cowork`, and `Code` modes.
- **Gatehouse Approvals:** Review and authorize pending actions and tool executions from anywhere.
- **Herd Management:** Inspect agent profiles, roles, active sessions, and specialties.
- **System Governance:** Cycle skill states, connect/disconnect MCP servers, set tool risk profiles, and manage budget modes.
- **System Logs & Pulse:** Live event streaming and real-time backend log tailing directly on your device.

## 📦 Installation

A pre-built APK is included in the root of this repository for immediate sideloading on Android devices.

1. Download [`GoatCitadel.apk`](./GoatCitadel.apk) from this repository to your Android device.
2. Open the file and follow the system prompts to install (you may need to allow installation from unknown sources).
3. Open the app and enter your GoatCitadel Gateway URL (and Auth Token if enabled) to connect!

## 🛠️ Local Development

### Prerequisites

- Node.js (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio / Android SDK (for local compilation)

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/spurnout/GoatCitadel-mobile.git
   cd GoatCitadel-mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

Press `a` to run on an attached Android device/emulator, or scan the QR code using the Expo Go app.

### Building the APK Locally

To compile a standalone APK exactly like the one provided:

```bash
cd android
./gradlew assembleRelease
```
The output will be found in `android/app/build/outputs/apk/release/app-release.apk`.

## 🔗 Main Repository

This project is the mobile frontend for the GoatCitadel ecosystem. For the core orchestration engine, CLI tools, desktop Mission Control, and server components, please visit the main repository:

**[spurnout/GoatCitadel](https://github.com/spurnout/GoatCitadel)**
