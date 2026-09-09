/** @jest-environment node */

jest.mock("next-auth", () => ({ __esModule: true, default: jest.fn(() => jest.fn()) }));
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("next-auth/providers/credentials", () => ({ __esModule: true, default: (options: unknown) => options }));
jest.mock("./server-api", () => ({ internalApi: { POST: jest.fn() } }));

import { auth, authOptions } from "./auth";
import type { AdapterUser } from "next-auth/adapters";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { CredentialInput, CredentialsConfig } from "next-auth/providers/credentials";

type CredentialFields = { email: CredentialInput; password: CredentialInput };
const credentialsProvider = authOptions.providers[0] as CredentialsConfig<CredentialFields>;
const credentialsRequest: Parameters<typeof credentialsProvider.authorize>[1] = {
  body: {},
  query: {},
  headers: {},
  method: "POST",
};

function authorizeCredentials(credentials: Partial<Record<keyof CredentialFields, string>>) {
  return credentialsProvider.authorize(
    { email: credentials.email ?? "", password: credentials.password ?? "" },
    credentialsRequest,
  );
}
const mockPost = (jest.requireMock("./server-api") as { internalApi: { POST: jest.Mock } }).internalApi.POST;
const mockGetServerSession = (jest.requireMock("next-auth/next") as { getServerSession: jest.Mock }).getServerSession;

type JwtCallbackArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>>[0];
type SessionCallbackArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["session"]>>[0];
type AppUser = User & {
  accessToken: string;
  username: string;
  isDemoUser: boolean;
  demoExpiresAt: string;
};

const sessionAgeEnvKeys = ["AUTH_SESSION_MAX_AGE", "NEXTAUTH_SESSION_MAX_AGE"] as const;
type SessionAgeEnvKey = (typeof sessionAgeEnvKeys)[number];
type SessionAgeEnv = Partial<Record<SessionAgeEnvKey, string>>;

function loadAuthOptionsForSessionAge(overrides: SessionAgeEnv): typeof authOptions {
  const previous = Object.fromEntries(sessionAgeEnvKeys.map((key) => [key, process.env[key]])) as Record<
    SessionAgeEnvKey,
    string | undefined
  >;

  for (const key of sessionAgeEnvKeys) {
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    let isolatedOptions: typeof authOptions | undefined;
    jest.isolateModules(() => {
      isolatedOptions = jest.requireActual<typeof import("./auth")>("./auth").authOptions;
    });
    if (!isolatedOptions) throw new Error("Expected isolated auth options");
    return isolatedOptions;
  } finally {
    for (const key of sessionAgeEnvKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function expectSessionAge(options: typeof authOptions, expectedMaxAge: number) {
  expect(options.session).toMatchObject({ strategy: "jwt", maxAge: expectedMaxAge });
  expect(options.jwt).toMatchObject({ maxAge: expectedMaxAge });
}

describe("session duration configuration", () => {
  const defaultMaxAge = 60 * 60 * 24 * 7;

  it("prefers AUTH_SESSION_MAX_AGE over NEXTAUTH_SESSION_MAX_AGE", () => {
    const options = loadAuthOptionsForSessionAge({
      AUTH_SESSION_MAX_AGE: "10m",
      NEXTAUTH_SESSION_MAX_AGE: "2h",
    });

    expectSessionAge(options, 600);
  });

  it.each([
    ["uses the default when both values are absent", {}, defaultMaxAge],
    ["falls back for a blank value", { AUTH_SESSION_MAX_AGE: "   " }, defaultMaxAge],
    ["falls back for malformed input", { AUTH_SESSION_MAX_AGE: "two-hours" }, defaultMaxAge],
    ["falls back for a non-positive unit value", { AUTH_SESSION_MAX_AGE: "0h" }, defaultMaxAge],
  ])("%s", (_description, values: SessionAgeEnv, expectedMaxAge: number) => {
    expectSessionAge(loadAuthOptionsForSessionAge(values), expectedMaxAge);
  });

  it.each([
    ["zero", "0"],
    ["negative", "-4"],
    ["subsecond", "0.8"],
  ])("clamps a finite %s numeric value to one second", (_description, value: string) => {
    expectSessionAge(loadAuthOptionsForSessionAge({ AUTH_SESSION_MAX_AGE: value }), 1);
  });

  it.each([
    ["seconds", "15s", 15],
    ["minutes", "2m", 120],
    ["hours with case and whitespace", " 2H ", 7200],
    ["days", "1d", 86400],
  ])("normalizes a valid %s unit value", (_description, value: string, expectedMaxAge: number) => {
    expectSessionAge(loadAuthOptionsForSessionAge({ NEXTAUTH_SESSION_MAX_AGE: value }), expectedMaxAge);
  });
});

describe("credentials authentication boundary", () => {
  const originalDemoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_DEMO_ENABLED;
    delete process.env.NEXT_PUBLIC_DEMO_EMAIL;
    delete process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  });

  afterAll(() => {
    if (originalDemoEnabled === undefined) delete process.env.NEXT_PUBLIC_DEMO_ENABLED;
    else process.env.NEXT_PUBLIC_DEMO_ENABLED = originalDemoEnabled;
  });

  it("refuses missing credentials without contacting the API", async () => {
    await expect(authorizeCredentials({ email: "", password: "password" })).resolves.toBeNull();
    await expect(authorizeCredentials({ email: "person@example.test" })).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("dispatches configured demo credentials only to the demo endpoint", async () => {
    process.env.NEXT_PUBLIC_DEMO_ENABLED = "true";
    process.env.NEXT_PUBLIC_DEMO_EMAIL = "demo@example.test";
    process.env.NEXT_PUBLIC_DEMO_PASSWORD = "demo-password";
    mockPost.mockResolvedValue({
      data: {
        user: { id: "demo-id", email: "demo@example.test", fullName: "Demo", username: "demo" },
        accessToken: "token",
      },
      response: { ok: true, status: 200 },
    });

    await expect(
      authorizeCredentials({ email: "demo@example.test", password: "demo-password" }),
    ).resolves.toMatchObject({
      id: "demo-id",
      username: "demo",
      accessToken: "token",
    });
    expect(mockPost).toHaveBeenCalledWith("/api/auth/demo", { cache: "no-store" });
  });

  it("handles ordinary login status and maps a successful API response into the session contract", async () => {
    mockPost.mockResolvedValueOnce({ response: { ok: false, status: 401 } });
    await expect(authorizeCredentials({ email: "person@example.test", password: "password" })).resolves.toBeNull();

    mockPost.mockResolvedValueOnce({ error: { message: "Backend unavailable" }, response: { ok: false, status: 503 } });
    await expect(authorizeCredentials({ email: "person@example.test", password: "password" })).rejects.toThrow(
      "Backend unavailable",
    );

    mockPost.mockResolvedValueOnce({
      data: {
        user: { id: "person-id", email: "person@example.test", fullName: "Person", username: "person" },
        accessToken: "access-token",
        isDemoUser: true,
        demoExpiresAt: "2026-09-09T00:00:00.000Z",
      },
      response: { ok: true, status: 200 },
    });
    await expect(authorizeCredentials({ email: "person@example.test", password: "password" })).resolves.toMatchObject({
      id: "person-id",
      name: "Person",
      username: "person",
      accessToken: "access-token",
      isDemoUser: true,
    });
    expect(mockPost).toHaveBeenLastCalledWith("/api/auth/login", {
      body: { email: "person@example.test", password: "password" },
      cache: "no-store",
    });
  });

  it("copies application user fields into JWT and session callbacks", async () => {
    const user: AppUser = {
      id: "id",
      accessToken: "token",
      username: "name",
      isDemoUser: true,
      demoExpiresAt: "later",
    };
    const jwtArgs: JwtCallbackArgs = {
      token: {},
      user,
      account: null,
      trigger: "signIn",
    };
    const token = await authOptions.callbacks!.jwt!(jwtArgs);
    expect(token).toMatchObject({ accessToken: "token", username: "name", isDemoUser: true, demoExpiresAt: "later" });
    const initialSession: Session = { user: { id: "id" }, expires: "2026-09-09T00:00:00.000Z" };
    const sessionToken: JWT = { sub: "id", username: "name", isDemoUser: true, demoExpiresAt: "later" };
    const adapterUser: AdapterUser = { id: "id", email: "person@example.test", emailVerified: null };
    const sessionArgs: SessionCallbackArgs = {
      session: initialSession,
      token: sessionToken,
      user: adapterUser,
      newSession: {},
      trigger: "update",
    };
    const session = await authOptions.callbacks!.session!(sessionArgs);
    expect(session.user).toMatchObject({ id: "id", username: "name", isDemoUser: true, demoExpiresAt: "later" });
    await auth();
    expect(mockGetServerSession).toHaveBeenCalledWith(authOptions);
  });
});
