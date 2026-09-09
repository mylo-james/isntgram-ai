"use strict";
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const hash = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
function assert(ok, message) {
  if (!ok) throw new Error(`Release stopped: ${message}`);
}
function identity(e = process.env) {
  assert(
    /^[a-f0-9]{40}$/.test(e.SOURCE_SHA || "") && e.SOURCE_SHA === e.GITHUB_SHA,
    "source differs from dispatch commit",
  );
  assert(["preview", "production"].includes(e.TARGET), "unknown target");
  assert(
    /^[A-Za-z0-9._-]{1,128}$/.test(e.CONFIG_REVISION || "") &&
      /^prj_[A-Za-z0-9]+$/.test(e.API_PROJECT_ID || "") &&
      /^prj_[A-Za-z0-9]+$/.test(e.WEB_PROJECT_ID || "") &&
      e.API_PROJECT_ID !== e.WEB_PROJECT_ID,
    "missing or duplicate project/config identity",
  );
  return {
    app: "isntgram",
    repository: e.GITHUB_REPOSITORY,
    sourceSha: e.SOURCE_SHA,
    environment: e.TARGET,
    configRevision: e.CONFIG_REVISION,
    apiProjectId: e.API_PROJECT_ID,
    webProjectId: e.WEB_PROJECT_ID,
  };
}
function maintenanceRecord(value) {
  const r = typeof value === "string" ? JSON.parse(value) : value;
  assert(
    r?.version === 1 &&
      /^[a-f0-9]{40}$/.test(r.sourceSha || "") &&
      /^[A-Za-z0-9._-]{1,128}$/.test(r.configRevision || ""),
    "invalid deployed maintenance record",
  );
  return r;
}
async function recordMaintenance(current, env = process.env, request = fetch) {
  assert(env.MAINTENANCE_RECORD_TOKEN, "maintenance record credential is unavailable");
  const name = "ISNTGRAM_DEPLOYED_RECORD";
  const value = JSON.stringify(
    maintenanceRecord({ version: 1, sourceSha: current.sourceSha, configRevision: current.configRevision }),
  );
  const url = `${env.GITHUB_API_URL || "https://api.github.com"}/repos/${current.repository}/environments/${current.environment}/variables/${name}`;
  const headers = {
    Authorization: `Bearer ${env.MAINTENANCE_RECORD_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const result = await request(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name, value }),
    signal: AbortSignal.timeout(20000),
  });
  assert(result.status === 204, "maintenance record update failed");
  const verified = await request(url, { headers, signal: AbortSignal.timeout(20000) });
  assert(verified.ok && (await verified.json()).value === value, "maintenance record verification failed");
}
function validate(r) {
  assert(r?.version === 1 && r.app === "isntgram", "wrong receipt");
  for (const key of ["sourceSha", "sourceTree"]) assert(/^[a-f0-9]{40}$/.test(r[key] || ""), `invalid ${key}`);
  for (const unit of ["api", "web"]) {
    const x = r[unit];
    assert(
      x && /^[a-f0-9]{64}$/.test(x.artifactDigest || "") && /^[a-f0-9]{64}$/.test(x.configDigest || ""),
      `missing ${unit} digests`,
    );
    assert(/^dpl_[A-Za-z0-9]+$/.test(x.deploymentId || ""), `invalid ${unit} deployment`);
    assert(x.checks?.health === "passed" && x.checks?.inspection === "passed", `unverified ${unit}`);
  }
  assert(Array.isArray(r.migrations) && r.migrations.length > 0, "missing schema records");
  assert(r.status === "staged" && /^\d+$/.test(r.stageRunId || ""), "not staged");
  return r;
}
function inspect(d, x) {
  assert(
    (d.uid || d.id) === x.deploymentId && (d.projectId || d.project?.id) === x.projectId,
    "deployment/project changed",
  );
  assert((d.readyState || d.state || d.status) === "READY", "not ready");
  assert(
    x.environment === "production" ? d.target === "production" : d.target === null || d.target === "preview",
    "wrong deployment target",
  );
  assert(d.meta?.deploymentSourceSha === x.sourceSha, "deployment source metadata differs");
}
function metadata(project, response, unit, e = process.env) {
  const preview = e.TARGET === "preview";
  const web = preview ? "https://isntgram-preview.mjames.dev" : "https://isntgram.mjames.dev";
  const media = preview ? "https://isntgram-media-preview.mjames.dev" : "https://isntgram-media.mjames.dev";
  const parent = preview ? "https://preview.mjames.dev" : "https://mjames.dev";
  assert(project.id === (unit === "api" ? e.API_PROJECT_ID : e.WEB_PROJECT_ID), "live project differs");
  const expected =
    unit === "web"
      ? {
          DEPLOYMENT_ENV: e.TARGET,
          NEXT_PUBLIC_APP_URL: web,
          NEXTAUTH_URL: web,
          ISNTGRAM_PORTFOLIO_ORIGIN: parent,
          NEXT_PUBLIC_DEMO_ENABLED: "true",
          NEXT_PUBLIC_MEDIA_HOSTS: new URL(media).hostname,
          INTERNAL_API_URL: e.API_ORIGIN,
        }
      : {
          DEPLOYMENT_ENV: e.TARGET,
          DEMO_ENABLED: "true",
          DEMO_TTL_HOURS: "48",
          CORS_ORIGIN: web,
          S3_PUBLIC_BASE_URL: media,
          TRUST_PROXY: "true",
        };
  const entries = response.envs.filter((x) => x.target?.includes(e.TARGET));
  for (const [key, value] of Object.entries(expected)) {
    const matches = entries.filter((x) => x.key === key);
    assert(
      matches.length === 1 && !matches[0].gitBranch && matches[0].type === "plain" && matches[0].value === value,
      `public input ${unit}.${key} differs`,
    );
  }
  const sanitized = {
    projectId: project.id,
    settings: Object.fromEntries(
      ["framework", "rootDirectory", "buildCommand", "installCommand", "nodeVersion"].map((k) => [
        k,
        project[k] ?? null,
      ]),
    ),
    environment: e.TARGET,
    entries: entries
      .map((x) => ({
        key: x.key,
        id: x.id,
        updatedAt: x.updatedAt,
        target: [...x.target].sort(),
        gitBranch: x.gitBranch ?? null,
        type: x.type,
        ...(Object.hasOwn(expected, x.key) ? { publicValue: x.value } : {}),
      }))
      .sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id)),
  };
  return { digest: hash(sanitized), publicInputs: expected };
}
async function provider(path) {
  const url = new URL(path, "https://api.vercel.com");
  if (process.env.VERCEL_ORG_ID) url.searchParams.set("teamId", process.env.VERCEL_ORG_ID);
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    signal: AbortSignal.timeout(20000),
  });
  assert(r.ok, `provider metadata HTTP ${r.status}`);
  return r.json();
}
async function config(unit) {
  const id = unit === "api" ? process.env.API_PROJECT_ID : process.env.WEB_PROJECT_ID;
  assert(/^prj_[A-Za-z0-9]+$/.test(id || ""), "invalid project ID");
  const [p, e] = await Promise.all([provider(`/v9/projects/${id}`), provider(`/v10/projects/${id}/env`)]);
  return metadata(p, e, unit);
}
async function github(path) {
  const r = await fetch(
    `${process.env.GITHUB_API_URL || "https://api.github.com"}/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(20000),
    },
  );
  assert(r.ok, `GitHub evidence HTTP ${r.status}`);
  return r.json();
}
function schema() {
  const result = execFileSync(
    "psql",
    [
      "--no-psqlrc",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "SELECT json_agg(x ORDER BY x.timestamp) FROM (SELECT timestamp::text, name FROM migrations) x",
    ],
    { env: { ...process.env, PGDATABASE: process.env.DATABASE_DIRECT_URL }, encoding: "utf8" },
  );
  return JSON.parse(result.trim());
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "validate") {
    validate(read(args[0]));
    return;
  }
  const current = identity();
  if (command === "identity") return;
  if (command === "record-maintenance") {
    await recordMaintenance(current);
    return;
  }
  if (command === "config") {
    console.log(JSON.stringify(await config(args[0])));
    return;
  }
  if (command === "schema") {
    console.log(JSON.stringify(schema()));
    return;
  }
  if (command === "check-ci") {
    const r = await github(`commits/${current.sourceSha}/check-runs?per_page=100`);
    for (const name of [
      "Code Quality",
      "Coverage Gate",
      "Integration Tests",
      "E2E Tests",
      "Production Build",
      "Security Scans",
    ]) {
      const run = r.check_runs.filter((x) => x.name === name).sort((a, b) => b.id - a.id)[0];
      assert(
        run?.app?.slug === "github-actions" && run.status === "completed" && run.conclusion === "success",
        `required check ${name} has not passed`,
      );
    }
    return;
  }
  if (command === "unit") {
    const [unit, inspectionFile, artifactFile, configFile, previousFile, output] = args;
    const d = read(inspectionFile),
      projectId = unit === "api" ? current.apiProjectId : current.webProjectId,
      deploymentId = d.uid || d.id;
    inspect(d, { deploymentId, projectId, environment: current.environment, sourceSha: current.sourceSha });
    const entry = {
      projectId,
      deploymentId,
      url: new URL(d.url.startsWith("https://") ? d.url : `https://${d.url}`).origin,
      artifactDigest: fs.readFileSync(artifactFile, "utf8").trim(),
      configDigest: read(configFile).digest,
      previousDeploymentId: read(previousFile).deploymentId,
      checks: { inspection: "passed", health: "passed" },
    };
    const health = await fetch(`${entry.url}${unit === "api" ? "/api/ready" : "/health"}`, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    assert(health.ok, `${unit} health HTTP ${health.status}`);
    const body = await health.json();
    assert(["ready", "ok"].includes(body.status), `${unit} health response differs`);
    fs.writeFileSync(output, `${JSON.stringify(entry, null, 2)}\n`);
    return;
  }
  if (command === "create") {
    const r = {
      version: 1,
      ...current,
      sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
      stageRunId: process.env.GITHUB_RUN_ID,
      cliVersion: "59.14.0",
      nodeVersion: process.version,
      status: "staged",
      api: read("api-receipt.json"),
      web: read("web-receipt.json"),
      migrations: schema(),
    };
    validate(r);
    fs.writeFileSync("isntgram-release-receipt.json", `${JSON.stringify(r, null, 2)}\n`);
    return;
  }
  if (command === "promotion") {
    const r = validate(read("isntgram-release-receipt.json"));
    for (const [key, value] of Object.entries(current)) assert(r[key] === value, `receipt ${key} differs`);
    assert(
      /^\d+$/.test(process.env.STAGE_RUN_ID || "") && process.env.STAGE_RUN_ID === r.stageRunId,
      "wrong stage run",
    );
    const run = await github(`actions/runs/${r.stageRunId}`);
    assert(
      run.conclusion === "success" &&
        run.event === "workflow_dispatch" &&
        run.head_sha === current.sourceSha &&
        run.path === ".github/workflows/deploy.yml",
      "stage run provenance differs",
    );
    assert(hash(schema()) === hash(r.migrations), "schema changed since stage");
    for (const unit of ["api", "web"])
      assert((await config(unit)).digest === r[unit].configDigest, `${unit} configuration changed`);
    return;
  }
  if (command === "inspection") {
    const r = validate(read("isntgram-release-receipt.json")),
      unit = args[0];
    inspect(read(args[1]), { ...r[unit], sourceSha: r.sourceSha, environment: r.environment });
    return;
  }
  throw new Error("Unknown release operation");
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { identity, validate, inspect, metadata, hash, maintenanceRecord, recordMaintenance };
