import { spawnSync } from "node:child_process";
import {
  listDevices,
  resolveAndroidTools,
  resolveApkPath,
  resolveSerial,
} from "./android-tools.mjs";

const argv = process.argv.slice(2);
const tools = resolveAndroidTools();

if (!tools.adbPath) {
  console.error("adb was not found. Run `npm run android:doctor` first.");
  process.exit(1);
}

const apkPath = resolveApkPath();
if (!apkPath) {
  console.error("No APK artifact was found. Build or copy GoatCitadel.apk first.");
  process.exit(1);
}

const serial = resolveSerial(argv);
const adbArgs = [];
if (serial) {
  adbArgs.push("-s", serial);
}
adbArgs.push("install", "-r", apkPath);

const result = spawnSync(tools.adbPath, adbArgs, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status !== 0) {
  const devices = listDevices(tools);
  if (devices.available) {
    console.error("");
    console.error("Detected adb devices:");
    for (const device of devices.items) {
      console.error(`- ${device}`);
    }
  }
  process.exit(result.status ?? 1);
}

console.log(`Installed ${apkPath}${serial ? ` to ${serial}` : ""}.`);
