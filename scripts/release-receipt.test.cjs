"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  identity,
  inspect,
  metadata,
  maintenanceRecord,
  recordMaintenance,
  requiredChecks,
  schema,
} = require("./release-receipt.cjs");

const env = {
  SOURCE_SHA: "a".repeat(40),
  GITHUB_SHA: "a".repeat(40),
  TARGET: "preview",
  CONFIG_REVISION: "r1",
  API_PROJECT_ID: "prj_api",
  WEB_PROJECT_ID: "prj_web",
  API_ORIGIN: "https://isntgram-api-preview.vercel.app",
  API_ALIAS: "isntgram-api-preview.vercel.app",
  WEB_ALIAS: "isntgram-preview.mjames.dev",
};
const publicWeb = {
  DEPLOYMENT_ENV: "preview",
  NEXT_PUBLIC_APP_URL: "https://isntgram-preview.mjames.dev",
  NEXTAUTH_URL: "https://isntgram-preview.mjames.dev",
  ISNTGRAM_PORTFOLIO_ORIGIN: "https://preview.mjames.dev",
  NEXT_PUBLIC_DEMO_ENABLED: "true",
  NEXT_PUBLIC_MEDIA_HOSTS: "isntgram-media-preview.mjames.dev",
  INTERNAL_API_URL: env.API_ORIGIN,
};
function response(values = publicWeb) {
  return {
    envs: Object.entries(values).map(([key, value], i) => ({
      key,
      value,
      id: `env_${i}`,
      updatedAt: 1,
      target: ["preview"],
      type: "plain",
    })),
  };
}

test("rejects a forged or non-full dispatch SHA", () => {
  assert.throws(() => identity({ ...env, SOURCE_SHA: "a".repeat(39) }));
  assert.throws(() => identity({ ...env, GITHUB_SHA: "b".repeat(40) }));
});
test("schema guard requires a direct database URL and passes it explicitly to psql", () => {
  assert.throws(() => schema({}), /database direct URL is unavailable/);
  let command;
  let arguments_;
  const rows = schema(
    { DATABASE_DIRECT_URL: "postgresql://test-user@127.0.0.1:55439/isolated" },
    (receivedCommand, receivedArguments) => {
      command = receivedCommand;
      arguments_ = receivedArguments;
      return '[{"timestamp":"1","name":"Initial"}]';
    },
  );
  assert.equal(command, "psql");
  assert.deepEqual(arguments_.slice(0, 4), [
    "--no-psqlrc",
    "--dbname",
    "postgresql://test-user@127.0.0.1:55439/isolated",
    "-tA",
  ]);
  assert.deepEqual(rows, [{ timestamp: "1", name: "Initial" }]);
  assert.throws(
    () =>
      schema({ DATABASE_DIRECT_URL: "postgresql://redacted@example/secret" }, () => {
        throw new Error("password=secret");
      }),
    /schema query failed/,
  );
});
test("a failed native schema process cannot forward credential diagnostics", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-schema-redaction-"));
  try {
    fs.writeFileSync(path.join(directory, "psql"), '#!/bin/sh\nprintf "synthetic-secret-marker\\n" >&2\nexit 1\n', {
      mode: 0o700,
    });
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `try { require(${JSON.stringify(require.resolve("./release-receipt.cjs"))}).schema(); } catch (error) { console.error(error.message); process.exitCode = 1; }`,
      ],
      {
        env: { ...process.env, PATH: directory, DATABASE_DIRECT_URL: "postgresql://synthetic:secret@invalid/fixture" },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    assert.equal(child.status, 1);
    assert.equal(child.stdout, "");
    assert.equal(child.stderr.trim(), "Release stopped: schema query failed");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("rejects wrong project, target, and non-ready inspection", () => {
  const expected = { deploymentId: "dpl_123", projectId: "prj_api", environment: "preview", sourceSha: env.SOURCE_SHA };
  assert.doesNotThrow(() =>
    inspect(
      {
        uid: "dpl_123",
        projectId: "prj_api",
        readyState: "READY",
        target: "preview",
        meta: { deploymentSourceSha: env.SOURCE_SHA },
      },
      expected,
    ),
  );
  assert.throws(() =>
    inspect(
      {
        uid: "dpl_123",
        projectId: "prj_other",
        readyState: "READY",
        target: "preview",
        meta: { deploymentSourceSha: env.SOURCE_SHA },
      },
      expected,
    ),
  );
  assert.throws(() =>
    inspect(
      {
        uid: "dpl_123",
        projectId: "prj_api",
        readyState: "BUILDING",
        target: "preview",
        meta: { deploymentSourceSha: env.SOURCE_SHA },
      },
      expected,
    ),
  );
  assert.throws(() =>
    inspect(
      {
        uid: "dpl_123",
        projectId: "prj_api",
        readyState: "READY",
        target: "production",
        meta: { deploymentSourceSha: env.SOURCE_SHA },
      },
      expected,
    ),
  );
});
test("metadata rejects changed public inputs and wrong target", () => {
  assert.doesNotThrow(() => metadata({ id: "prj_web" }, response(), "web", env));
  assert.throws(() =>
    metadata({ id: "prj_web" }, response({ ...publicWeb, NEXT_PUBLIC_APP_URL: "https://evil.example" }), "web", env),
  );
  const wrong = response();
  wrong.envs[0].target = ["production"];
  assert.throws(() => metadata({ id: "prj_web" }, wrong, "web", env));
});
test("metadata digest changes for an ID/update change but ignores secret value changes", () => {
  const base = response();
  base.envs.push({
    key: "DATABASE_URL",
    value: "secret-one",
    id: "env_secret",
    updatedAt: 1,
    target: ["preview"],
    type: "encrypted",
  });
  const secretChanged = structuredClone(base);
  secretChanged.envs.at(-1).value = "secret-two";
  const updated = structuredClone(base);
  updated.envs.at(-1).updatedAt = 2;
  const a = metadata({ id: "prj_web" }, base, "web", env).digest;
  assert.equal(metadata({ id: "prj_web" }, secretChanged, "web", env).digest, a);
  assert.notEqual(metadata({ id: "prj_web" }, updated, "web", env).digest, a);
});

test("maintenance source and configuration advance in one verified record", async () => {
  const current = {
    repository: "owner/repo",
    environment: "preview",
    sourceSha: env.SOURCE_SHA,
    configRevision: "r2",
    apiDeploymentId: "dpl_apiNew",
    releaseState: "api-serving",
  };
  const calls = [];
  let value;
  const request = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "PATCH") {
      value = JSON.parse(options.body).value;
      return { status: 204 };
    }
    return { ok: true, json: async () => ({ value }) };
  };
  await recordMaintenance(current, { MAINTENANCE_RECORD_TOKEN: "synthetic-only" }, request);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /environments\/preview\/variables\/ISNTGRAM_DEPLOYED_RECORD$/);
  assert.deepEqual(maintenanceRecord(value), {
    version: 1,
    scope: "api",
    sourceSha: env.SOURCE_SHA,
    configRevision: "r2",
    apiDeploymentId: "dpl_apiNew",
    releaseState: "api-serving",
  });
  await assert.rejects(recordMaintenance(current, {}, request), /credential/);
  await assert.rejects(
    recordMaintenance(current, { MAINTENANCE_RECORD_TOKEN: "synthetic-only" }, async () => ({ status: 403 })),
    /update failed/,
  );
  await assert.rejects(
    recordMaintenance(current, { MAINTENANCE_RECORD_TOKEN: "synthetic-only" }, async (_url, options) =>
      options.method === "PATCH" ? { status: 204 } : { ok: true, json: async () => ({ value: "stale" }) },
    ),
    /verification failed/,
  );
  assert.throws(() => maintenanceRecord({ version: 1, sourceSha: "short", configRevision: "r1" }));
});

test("binds exact target aliases and refuses crossed, changed or credential-bearing origins", () => {
  const accepted = identity(env);
  assert.equal(accepted.webAlias, "isntgram-preview.mjames.dev");
  assert.equal(accepted.apiAlias, "isntgram-api-preview.vercel.app");
  for (const changed of [
    { WEB_ALIAS: env.API_ALIAS },
    { API_ALIAS: env.WEB_ALIAS },
    { WEB_ALIAS: "isntgram.mjames.dev" },
    { API_ALIAS: "other.vercel.app" },
    { API_ORIGIN: "https://user:password@isntgram-api-preview.vercel.app" },
    { API_ORIGIN: env.API_ORIGIN + "/" },
    { API_ORIGIN: "https://foreign.example" },
  ])
    assert.throws(() => identity({ ...env, ...changed }));
  assert.doesNotThrow(() => identity({ ...env, TARGET: "production", WEB_ALIAS: "isntgram.mjames.dev" }));
});
test("partial API promotion never claims a completed pair in maintenance provenance", () => {
  const serving = {
    version: 1,
    scope: "api",
    sourceSha: env.SOURCE_SHA,
    configRevision: "r2",
    apiDeploymentId: "dpl_apiNew",
    releaseState: "api-serving",
  };
  assert.equal(maintenanceRecord({ ...serving, releaseState: "promotion-pending" }).releaseState, "promotion-pending");
  assert.equal(maintenanceRecord(serving).releaseState, "api-serving");
  assert.equal(maintenanceRecord({ ...serving, releaseState: "pair-healthy" }).releaseState, "pair-healthy");
  for (const change of [{ scope: "app" }, { releaseState: "accepted" }, { apiDeploymentId: "" }])
    assert.throws(() => maintenanceRecord({ ...serving, ...change }));
});

test("a successful scan job cannot override a failed independent security check", () => {
  const names = [
    "Code Quality",
    "Coverage Gate",
    "Integration Tests",
    "E2E Tests",
    "Production Build",
    "Security Scans",
    "CodeQL",
    "gitleaks",
  ];
  const checks = names.map((name, i) => ({
    id: i + 1,
    name,
    head_sha: env.SOURCE_SHA,
    app: { slug: i < 6 ? "github-actions" : "github-advanced-security" },
    status: "completed",
    conclusion: "success",
  }));
  assert.doesNotThrow(() => requiredChecks(checks, env.SOURCE_SHA));
  for (const changed of [
    { conclusion: "failure" },
    { conclusion: "skipped" },
    { status: "in_progress" },
    { head_sha: "b".repeat(40) },
    { app: { slug: "foreign-app" } },
  ]) {
    const copy = structuredClone(checks);
    Object.assign(copy[6], changed);
    assert.throws(() => requiredChecks(copy, env.SOURCE_SHA), /CodeQL/);
  }
  assert.throws(() => requiredChecks(checks.slice(0, 6), env.SOURCE_SHA), /CodeQL/);
  assert.throws(
    () => requiredChecks([...checks, { ...checks[6], id: 99, conclusion: "failure" }], env.SOURCE_SHA),
    /CodeQL/,
  );
});
