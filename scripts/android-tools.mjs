import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const repoRoot = path.resolve(currentDir, "..");

export function platformExecutable(relativePath) {
  return process.platform === "win32" ? `${relativePath}.exe` : relativePath;
}

export function uniqueValues(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

export function candidateSdkRoots() {
  const home = os.homedir();
  const windowsDefaults = [
    "F:\\Android\\Sdk",
    path.join(home, "AppData", "Local", "Android", "Sdk"),
  ];
  const unixDefaults = [
    path.join(home, "Android", "Sdk"),
    path.join(home, "Library", "Android", "sdk"),
  ];

  return uniqueValues([
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    ...(process.platform === "win32" ? windowsDefaults : unixDefaults),
  ]);
}

export function resolveSdkRoot() {
  const candidates = candidateSdkRoots();
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        path: candidate,
        source: sdkSourceLabel(candidate),
      };
    }
  }

  return {
    path: undefined,
    source: undefined,
    attempted: candidates,
  };
}

function sdkSourceLabel(candidate) {
  if (candidate === process.env.ANDROID_SDK_ROOT) {
    return "ANDROID_SDK_ROOT";
  }
  if (candidate === process.env.ANDROID_HOME) {
    return "ANDROID_HOME";
  }
  return "fallback";
}

function findExecutableOnPath(commandName) {
  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookupCommand, [commandName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return undefined;
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

export function resolveAndroidTools() {
  const sdk = resolveSdkRoot();
  const adbCandidate = sdk.path ? path.join(sdk.path, platformExecutable(path.join("platform-tools", "adb"))) : undefined;
  const emulatorCandidate = sdk.path ? path.join(sdk.path, platformExecutable(path.join("emulator", "emulator"))) : undefined;

  return {
    sdkRoot: sdk.path,
    sdkSource: sdk.source,
    attemptedSdkRoots: sdk.attempted ?? candidateSdkRoots(),
    adbPath: adbCandidate && existsSync(adbCandidate) ? adbCandidate : findExecutableOnPath("adb"),
    emulatorPath: emulatorCandidate && existsSync(emulatorCandidate) ? emulatorCandidate : findExecutableOnPath("emulator"),
  };
}

export function runCommand(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function listAvds(tools) {
  if (!tools.emulatorPath) {
    return {
      available: false,
      items: [],
      error: "Android emulator binary not found.",
    };
  }

  const result = runCommand(tools.emulatorPath, ["-list-avds"]);
  if (result.status !== 0) {
    return {
      available: false,
      items: [],
      error: result.stderr.trim() || result.stdout.trim() || "Failed to list Android Virtual Devices.",
    };
  }

  return {
    available: true,
    items: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

export function listDevices(tools) {
  if (!tools.adbPath) {
    return {
      available: false,
      items: [],
      error: "adb binary not found.",
    };
  }

  const result = runCommand(tools.adbPath, ["devices", "-l"]);
  if (result.status !== 0) {
    return {
      available: false,
      items: [],
      error: result.stderr.trim() || result.stdout.trim() || "Failed to list adb devices.",
    };
  }

  const items = result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("*"));

  return {
    available: true,
    items,
  };
}

export function preferredApkPaths() {
  return [
    process.env.ANDROID_APK_PATH,
    path.join(repoRoot, "GoatCitadel.apk"),
    path.join(repoRoot, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
  ].filter(Boolean);
}

export function resolveApkPath(explicitPath) {
  const candidates = uniqueValues([explicitPath, ...preferredApkPaths()]);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function fileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function readPackageVersion() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return packageJson.version ?? "unknown";
}

export function resolveAvdName(argv) {
  const avdFlag = argv.find((entry) => entry.startsWith("--avd="));
  if (avdFlag) {
    return avdFlag.slice("--avd=".length).trim();
  }

  const avdIndex = argv.indexOf("--avd");
  if (avdIndex >= 0) {
    return argv[avdIndex + 1]?.trim();
  }

  return process.env.ANDROID_AVD?.trim();
}

export function resolveSerial(argv) {
  const serialFlag = argv.find((entry) => entry.startsWith("--serial="));
  if (serialFlag) {
    return serialFlag.slice("--serial=".length).trim();
  }

  const serialIndex = argv.indexOf("--serial");
  if (serialIndex >= 0) {
    return argv[serialIndex + 1]?.trim();
  }

  return process.env.ANDROID_SERIAL?.trim();
}

export function resolveOutputPath(argv, defaultPath) {
  const outFlag = argv.find((entry) => entry.startsWith("--out="));
  if (outFlag) {
    return path.resolve(repoRoot, outFlag.slice("--out=".length).trim());
  }

  const outIndex = argv.indexOf("--out");
  if (outIndex >= 0) {
    return path.resolve(repoRoot, argv[outIndex + 1] ?? defaultPath);
  }

  return path.resolve(repoRoot, defaultPath);
}

export function ensureParentDirectory(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeTextFile(filePath, contents) {
  ensureParentDirectory(filePath);
  writeFileSync(filePath, contents, "utf8");
}

export function apkMetadata(apkPath) {
  if (!apkPath || !existsSync(apkPath)) {
    return undefined;
  }

  const stats = statSync(apkPath);
  return {
    path: apkPath,
    bytes: stats.size,
    size: formatBytes(stats.size),
    sha256: fileSha256(apkPath),
    updatedAt: stats.mtime.toISOString(),
  };
}

export function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}
