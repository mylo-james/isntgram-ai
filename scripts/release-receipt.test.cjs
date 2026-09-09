"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { identity, inspect, metadata, maintenanceRecord, recordMaintenance } = require("./release-receipt.cjs");

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
  const current = { repository: "owner/repo", environment: "preview", sourceSha: env.SOURCE_SHA, configRevision: "r2", apiDeploymentId: "dpl_apiNew", releaseState: "api-serving" };
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
  assert.deepEqual(maintenanceRecord(value), { version: 1, scope: "api", sourceSha: env.SOURCE_SHA, configRevision: "r2", apiDeploymentId: "dpl_apiNew", releaseState: "api-serving" });
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
    { WEB_ALIAS: env.API_ALIAS }, { API_ALIAS: env.WEB_ALIAS },
    { WEB_ALIAS: "isntgram.mjames.dev" }, { API_ALIAS: "other.vercel.app" },
    { API_ORIGIN: "https://user:password@isntgram-api-preview.vercel.app" },
    { API_ORIGIN: env.API_ORIGIN + "/" }, { API_ORIGIN: "https://foreign.example" },
  ]) assert.throws(() => identity({ ...env, ...changed }));
  assert.doesNotThrow(() => identity({ ...env, TARGET: "production", WEB_ALIAS: "isntgram.mjames.dev" }));
});
test("partial API promotion never claims a completed pair in maintenance provenance", () => {
  const serving = { version: 1, scope: "api", sourceSha: env.SOURCE_SHA, configRevision: "r2",
    apiDeploymentId: "dpl_apiNew", releaseState: "api-serving" };
  assert.equal(maintenanceRecord({ ...serving, releaseState: "promotion-pending" }).releaseState, "promotion-pending");
  assert.equal(maintenanceRecord(serving).releaseState, "api-serving");
  assert.equal(maintenanceRecord({ ...serving, releaseState: "pair-healthy" }).releaseState, "pair-healthy");
  for (const change of [{scope: "app"}, {releaseState: "accepted"}, {apiDeploymentId: ""}])
    assert.throws(() => maintenanceRecord({ ...serving, ...change }));
});
