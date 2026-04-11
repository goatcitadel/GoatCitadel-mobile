import path from "node:path";
import { writeFileSync } from "node:fs";
import {
  ensureParentDirectory,
  listDevices,
  repoRoot,
  resolveAndroidTools,
  resolveOutputPath,
  resolveSerial,
  runCommand,
} from "./android-tools.mjs";

const argv = process.argv.slice(2);
const tools = resolveAndroidTools();

if (!tools.adbPath) {
  console.error("adb was not found. Run `npm run android:doctor` first.");
  process.exit(1);
}

const devices = listDevices(tools);
if (!devices.available || devices.items.length === 0) {
  console.error(devices.error ?? "No adb devices are connected.");
  process.exit(1);
}

const requestedSerial = resolveSerial(argv);
const serial = requestedSerial ?? devices.items[0].split(/\s+/)[0];

if (!serial) {
  console.error("Could not resolve an adb serial for the smoke test.");
  process.exit(1);
}

const screenshotPath = resolveOutputPath(argv, path.join("artifacts", "android-share-smoke.png"));
const attachmentPath = path.join(repoRoot, "artifacts", "android-share-smoke.txt");
ensureParentDirectory(attachmentPath);
writeFileSync(attachmentPath, "Citadel Android share smoke attachment\n", "utf8");

function adb(args, { allowFailure = false } = {}) {
  const result = runCommand(tools.adbPath, ["-s", serial, ...args]);
  if (!allowFailure && result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    process.stdout.write(result.stdout ?? "");
    process.exit(result.status ?? 1);
  }
  return result;
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

printResult(adb(["logcat", "-c"]));

const textIntent = adb([
  "shell",
  "am",
  "start",
  "-W",
  "-a",
  "android.intent.action.SEND",
  "-t",
  "text/plain",
  "-n",
  "com.goatcitadel.mobile/.MainActivity",
  "--es",
  "android.intent.extra.SUBJECT",
  "Citadel smoke text",
  "--es",
  "android.intent.extra.TEXT",
  "Smoke test share payload from android-share-smoke.mjs.",
]);
printResult(textIntent);

const pushResult = adb(["push", attachmentPath, "/sdcard/Download/android-share-smoke.txt"]);
printResult(pushResult);

const attachmentIntent = adb([
  "shell",
  "am",
  "start",
  "-W",
  "-a",
  "android.intent.action.SEND",
  "-t",
  "text/plain",
  "-n",
  "com.goatcitadel.mobile/.MainActivity",
  "--es",
  "android.intent.extra.SUBJECT",
  "Citadel smoke attachment",
  "--eu",
  "android.intent.extra.STREAM",
  "file:///sdcard/Download/android-share-smoke.txt",
]);
printResult(attachmentIntent);

const crashLog = adb(["logcat", "-d", "-v", "brief"], { allowFailure: true });
const crashLines = (crashLog.stdout ?? "")
  .split(/\r?\n/)
  .filter((line) => /AndroidRuntime|FATAL EXCEPTION|couldn't find DSO|Process .* has died/i.test(line));

const screenshot = adb(["exec-out", "screencap", "-p"], { allowFailure: true });
if ((screenshot.stdout ?? "").length > 0) {
  ensureParentDirectory(screenshotPath);
  writeFileSync(screenshotPath, screenshot.stdout, "binary");
}

const topActivity = adb(["shell", "dumpsys", "activity", "activities"], { allowFailure: true });
const topActivityLine = (topActivity.stdout ?? "")
  .split(/\r?\n/)
  .find((line) => line.includes("topResumedActivity") || line.includes("ResumedActivity"));

console.log("");
console.log(`Smoke target serial: ${serial}`);
console.log(`Screenshot: ${screenshotPath}`);
if (topActivityLine) {
  console.log(topActivityLine.trim());
}

if (crashLines.length > 0) {
  console.log("");
  console.log("Crash indicators:");
  for (const line of crashLines) {
    console.log(line);
  }
  process.exit(1);
}

console.log("");
console.log("Share smoke completed without detected crash indicators.");
