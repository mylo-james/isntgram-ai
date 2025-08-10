import "@testing-library/jest-dom";

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
