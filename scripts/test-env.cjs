const fs = require("node:fs");
const path = require("node:path");
const { selectTestDatabase } = require("../apps/api/test/test-database-target.cjs");

/** Reject dotenv inputs before Nest or Jest can load them. */
function assertNoTestDotenv(root) {
  for (const relative of [".", "apps/api", "apps/web"]) {
    const directory = path.join(root, relative);
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
      if (/^\.env(?:$|\.local$|\.(?:test|production|development))/.test(name)) {
        throw new Error(`Tests refuse loadable dotenv input in ${relative}; use a clean test shell.`);
      }
    }
  }
}

/** @param {NodeJS.ProcessEnv} source @param {string} root */
function buildTestEnvironment(source, root) {
  assertNoTestDotenv(root);
  const selection = selectTestDatabase(source);
  const env = { ...source };
  if (selection.kind === "sqlite") {
    for (const key of Object.keys(env)) {
      if (/^(?:DATABASE_|DB_|PG)/.test(key)) delete env[key];
    }
    env.NODE_ENV = "test";
  }
  return env;
}

module.exports = { assertNoTestDotenv, buildTestEnvironment };
