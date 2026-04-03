import {
  apkMetadata,
  listAvds,
  listDevices,
  readPackageVersion,
  resolveAndroidTools,
  resolveApkPath,
} from "./android-tools.mjs";

const argv = process.argv.slice(2);
const listOnly = argv.includes("--list-avds");
const tools = resolveAndroidTools();
const avds = listAvds(tools);

if (listOnly) {
  if (!avds.available) {
    console.error(avds.error);
    process.exit(1);
  }
  for (const avd of avds.items) {
    console.log(avd);
  }
  process.exit(0);
}

const devices = listDevices(tools);
const apk = apkMetadata(resolveApkPath());
const issues = [];

if (!tools.sdkRoot) {
  issues.push("Android SDK root was not found.");
}
if (!tools.adbPath) {
  issues.push("adb was not found.");
}
if (!tools.emulatorPath) {
  issues.push("Android emulator binary was not found.");
}
if (!avds.available || avds.items.length === 0) {
  issues.push("No Android Virtual Devices are currently available.");
}
if (!apk) {
  issues.push("No APK artifact was found at the repo root or the Gradle release output.");
}

console.log(`GoatCitadel Mobile Android doctor for v${readPackageVersion()}`);
console.log("");
console.log(`SDK root: ${tools.sdkRoot ?? "missing"}${tools.sdkSource ? ` (${tools.sdkSource})` : ""}`);
if (!tools.sdkRoot && tools.attemptedSdkRoots.length > 0) {
  console.log(`Checked: ${tools.attemptedSdkRoots.join(", ")}`);
}
console.log(`adb: ${tools.adbPath ?? "missing"}`);
console.log(`emulator: ${tools.emulatorPath ?? "missing"}`);
console.log("");

console.log("AVDs:");
if (avds.available && avds.items.length > 0) {
  for (const avd of avds.items) {
    console.log(`- ${avd}`);
  }
} else {
  console.log(`- ${avds.error ?? "none found"}`);
}
console.log("");

console.log("Connected devices:");
if (devices.available && devices.items.length > 0) {
  for (const device of devices.items) {
    console.log(`- ${device}`);
  }
} else {
  console.log(`- ${devices.error ?? "none connected"}`);
}
console.log("");

console.log("APK:");
if (apk) {
  console.log(`- path: ${apk.path}`);
  console.log(`- size: ${apk.size}`);
  console.log(`- sha256: ${apk.sha256}`);
  console.log(`- updated: ${apk.updatedAt}`);
} else {
  console.log("- not found");
}
console.log("");

console.log("Recommended next steps:");
console.log("1. npm run android:avd:list");
console.log("2. set ANDROID_AVD=<avd-name> && npm run android:emulator:start");
console.log("3. npm run android:install:apk");
console.log("4. npm run android:proof:handoff");

if (issues.length > 0) {
  console.log("");
  console.log("Blocking issues:");
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }
  process.exit(1);
}
