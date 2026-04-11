import { spawnSync } from "node:child_process";
import path from "node:path";
import { repoRoot } from "./android-tools.mjs";

const androidDir = path.join(repoRoot, "android");
const gradleArgs = [
  "assembleRelease",
  "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64",
];

const result = spawnSync(
  process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew",
  gradleArgs,
  {
    cwd: androidDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  },
);

process.exit(result.status ?? 1);
