import {
  listAvds,
  resolveAndroidTools,
  resolveAvdName,
  spawnDetached,
} from "./android-tools.mjs";

const argv = process.argv.slice(2);
const tools = resolveAndroidTools();

if (!tools.emulatorPath) {
  console.error("Android emulator binary not found. Run `npm run android:doctor` first.");
  process.exit(1);
}

const avds = listAvds(tools);
if (!avds.available) {
  console.error(avds.error);
  process.exit(1);
}

const avd = resolveAvdName(argv);
if (!avd) {
  console.error("No AVD selected. Set ANDROID_AVD or pass --avd <name>.");
  if (avds.items.length > 0) {
    console.error(`Available AVDs: ${avds.items.join(", ")}`);
  }
  process.exit(1);
}

if (!avds.items.includes(avd)) {
  console.error(`AVD "${avd}" was not found.`);
  console.error(`Available AVDs: ${avds.items.join(", ") || "none"}`);
  process.exit(1);
}

const emulatorArgs = ["-avd", avd, "-netdelay", "none", "-netspeed", "full"];
const pid = spawnDetached(tools.emulatorPath, emulatorArgs);

console.log(`Started Android emulator "${avd}" with PID ${pid}.`);
console.log("Use `adb devices -l` or `npm run android:doctor` to confirm when it is ready.");
