const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { buildTestEnvironment } = require("./test-env.cjs");
let env;
try {
  env = buildTestEnvironment(process.env, path.resolve(__dirname, ".."));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unsafe test environment refused.");
  process.exit(1);
}
const existingNodeOptions = env.NODE_OPTIONS ?? "";

const splitArgs = (value) => {
  // Match Node's NODE_OPTIONS grammar: double quotes, ASCII spaces, and
  // backslash escapes inside double quotes only.
  const args = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\") {
        if (i + 1 === value.length) throw new Error("Invalid escape in NODE_OPTIONS.");
        current += value[i + 1];
        i += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quote = char;
      continue;
    }
    if (char === " ") {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (quote) throw new Error("Unterminated string in NODE_OPTIONS.");
  if (current) {
    args.push(current);
  }
  return args;
};

const escapeArg = (arg) => {
  if (/[\\ "]/.test(arg)) {
    return `"${arg.replace(/[\\"]/g, "\\$&")}"`;
  }
  return arg;
};

const parsedNodeOptions = splitArgs(existingNodeOptions);
const cleanedNodeOptions = [];

for (let i = 0; i < parsedNodeOptions.length; i += 1) {
  const option = parsedNodeOptions[i];
  if (option === "--localstorage-file") {
    const next = parsedNodeOptions[i + 1];
    if (next && !next.startsWith("-")) {
      i += 1;
    }
    continue;
  }
  if (option.startsWith("--localstorage-file=")) {
    continue;
  }
  cleanedNodeOptions.push(option);
}

const serializedNodeOptions = cleanedNodeOptions.map(escapeArg).join(" ");
if (serializedNodeOptions) {
  env.NODE_OPTIONS = serializedNodeOptions;
} else {
  delete env.NODE_OPTIONS;
}

const jestBin = require.resolve("jest/bin/jest");
// pnpm can forward its option separator to this script. Consume that boundary
// so options such as --runInBand still reach Jest as options.
const jestArgs = process.argv.slice(2);
const separatorIndex = jestArgs.indexOf("--");
if (separatorIndex !== -1) jestArgs.splice(separatorIndex, 1);
const result = spawnSync(process.execPath, [jestBin, ...jestArgs], {
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
