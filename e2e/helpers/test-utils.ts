import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const apiBaseUrl = process.env.E2E_API_URL || "http://127.0.0.1:3001";

export type TestUser = {
  email: string;
  username: string;
  fullName: string;
  password: string;
};

const uniqueId = (label: string) => `${label}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const normalizeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, "_");

export const createTestUser = (label = "user"): TestUser => {
  const id = uniqueId(label);
  const safeId = normalizeId(id);
  const uniqueTail = safeId.split("_").slice(-2).join("_") || safeId;
  return {
    email: `e2e_${safeId}@example.com`,
    username: `e2e_${uniqueTail}`.slice(0, 30),
    fullName: `E2E ${label} ${id}`,
    password: "Password123!",
  };
};

export const createPostContent = (label = "post") => `E2E ${label} ${uniqueId(label)}`;

export const registerViaApi = async (request: APIRequestContext, user: TestUser): Promise<TestUser> => {
  const res = await request.post(`${apiBaseUrl}/api/auth/register`, {
    data: {
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      password: user.password,
    },
  });
  expect(res.status()).toBe(201);
  const payload = (await res.json()) as { user?: Partial<TestUser> };
  return {
    ...user,
    email: payload.user?.email ?? user.email,
    username: payload.user?.username ?? user.username,
    fullName: payload.user?.fullName ?? user.fullName,
  };
};

export const loginViaApi = async (request: APIRequestContext, user: TestUser) => {
  const res = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: {
      email: user.email,
      password: user.password,
    },
  });
  expect(res.status()).toBe(200);
  const payload = (await res.json()) as { accessToken?: string };
  expect(payload.accessToken).toBeTruthy();
  return payload;
};

export const createPostViaApi = async (request: APIRequestContext, token: string, content: string) => {
  const res = await request.post(`${apiBaseUrl}/api/posts`, {
    data: { content },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(res.status()).toBe(201);
  return res.json();
};

export const registerViaUi = async (page: Page, user: TestUser, options?: { navigate?: boolean }) => {
  if (options?.navigate !== false) {
    await page.goto("/register");
  }
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/full name/i).fill(user.fullName);
  await page.getByLabel(/username/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign up/i }).click();
};

export const loginViaUi = async (page: Page, user: TestUser, options?: { navigate?: boolean }) => {
  if (options?.navigate !== false) {
    await page.goto("/login");
  }
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /log in/i }).click();
};

export const expectOnFeed = async (page: Page) => {
  await page.waitForURL(/\/feed$/, { timeout: 15000 });
  await expect(page.getByRole("navigation")).toBeVisible();
};

/** Exercise the real presign, browser PUT, API decoder, and post binding. */
export const publishPhotoViaUi = async (page: Page, content: string) => {
  await page.goto("/upload");
  await expect(page.getByRole("textbox", { name: "Caption", exact: true })).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photo", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "blue-pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNwqzjhVnGCAUIBACiuBhkeMwAsAAAAAElFTkSuQmCC",
      "base64",
    ),
  });
  await page.getByRole("textbox", { name: "Caption", exact: true }).fill(content);
  await page.getByRole("textbox", { name: "Photo description" }).fill("A blue square used to test photo publishing.");
  const published = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/posts",
  );
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  const response = await published;
  expect(response.status(), await response.text()).toBe(201);
  const post = (await response.json()) as { id: string; mediaUrl: string; content: string };
  expect(post.content).toBe(content);
  expect(post.mediaUrl).toContain("/published/");
  const photo = await page.request.get(post.mediaUrl);
  expect(photo.ok()).toBe(true);
  expect(photo.headers()["content-type"]).toContain("image/png");
  expect((await photo.body()).length).toBeGreaterThan(0);
  await expectOnFeed(page);
  return post;
};
