import "cross-fetch/polyfill";
import "@testing-library/jest-dom";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const React = jest.requireActual("react") as typeof import("react");
    const { src, alt, ...rest } = props as {
      src?: unknown;
      alt?: unknown;
    } & Record<string, unknown>;

    delete rest.fill;
    delete rest.sizes;
    delete rest.priority;
    delete rest.loader;

    const resolvedSrc = typeof src === "string" ? src : ((src as { src?: string } | null)?.src ?? "");
    return React.createElement("img", { ...rest, src: resolvedSrc, alt });
  },
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
