import "@testing-library/jest-dom";

// `next-auth@5` is ESM-only and Jest does not transform `node_modules` by default.
// Keep tests deterministic by mocking the server-only `next-auth` entrypoint.
jest.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({
    handlers: { GET: jest.fn(), POST: jest.fn() },
    auth: jest.fn(async () => null),
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock("next-auth/providers/credentials", () => ({
  __esModule: true,
  default: jest.fn((options: unknown) => options),
}));

jest.mock("next/cache", () => ({
  __esModule: true,
  revalidatePath: jest.fn(),
}));

// Suppress expected console errors during tests to keep output clean
const originalConsoleError = console.error;

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const [first] = args;
    const msg = typeof first === "string" ? first : "";

    // Filter out known, expected logs from components under test
    if (msg.includes("Sign out error:") || msg.includes("Error fetching profile:")) {
      return;
    }

    // Otherwise, pass through
    (originalConsoleError as unknown as (...args: unknown[]) => void)(...args);
  });
});

afterAll(() => {
  (console.error as unknown as jest.Mock).mockRestore?.();
});
