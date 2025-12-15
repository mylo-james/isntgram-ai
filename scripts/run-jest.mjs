import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import os from "node:os";

const localStorageFile = path.join(os.tmpdir(), "isntgram-jest-localstorage.json");
const jestBin = path.join(process.cwd(), "node_modules", "jest", "bin", "jest.js");

const args = process.argv.slice(2);

const child = spawn(process.execPath, [`--localstorage-file=${localStorageFile}`, jestBin, ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

