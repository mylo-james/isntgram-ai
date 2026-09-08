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
  const args = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && i + 1 < value.length) {
        current += value[i + 1];
        i += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) {
    args.push(current);
  }
  return args;
};

const escapeArg = (arg) => {
  if (/[\\s"]/g.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
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
const result = spawnSync(process.execPath, [jestBin, ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
