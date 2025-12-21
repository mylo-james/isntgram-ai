import fs from "node:fs";
import path from "node:path";

describe("API contract artifacts", () => {
  it("apps/api/openapi.json is valid and contains key endpoints", () => {
    const openapiPath = path.resolve(__dirname, "../../../apps/api/openapi.json");
    const raw = fs.readFileSync(openapiPath, "utf8");
    const doc = JSON.parse(raw) as { openapi?: string; paths?: Record<string, unknown>; components?: unknown };

    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.paths).toHaveProperty("/api/auth/register");
    expect(doc.paths).toHaveProperty("/api/posts/feed");
    expect(doc.paths).toHaveProperty("/api/users/{username}");
  });
});
