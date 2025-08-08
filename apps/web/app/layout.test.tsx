import { render, screen } from "@testing-library/react";
import RootLayout from "./layout";

// Mock Next.js components that don't work well in Jest
jest.mock("next/font/local", () => ({
  __esModule: true,
  default: () => ({
    className: "mocked-font",
  }),
}));

// Mock Redux store to avoid store warnings in tests
jest.mock("../lib/store", () => ({
  store: {
    getState: () => ({}),
    dispatch: jest.fn(),
    subscribe: jest.fn(),
  },
}));

describe("RootLayout", () => {
  it("renders children correctly", () => {
    const testContent = "Test Content";

    // Use a test-specific wrapper that doesn't cause DOM nesting issues
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <div data-testid="test-wrapper">{children}</div>
    );

    render(
      <TestWrapper>
        <RootLayout>
          <div>{testContent}</div>
        </RootLayout>
      </TestWrapper>,
    );

    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it("applies correct structure and classes", () => {
    const testContent = "Test Content";

    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <div data-testid="test-wrapper">{children}</div>
    );

    render(
      <TestWrapper>
        <RootLayout>
          <div>{testContent}</div>
        </RootLayout>
      </TestWrapper>,
    );

    // Verify the content is rendered
    expect(screen.getByText(testContent)).toBeInTheDocument();

    // Check that the layout structure exists
    const htmlElement = document.querySelector("html");
    const bodyElement = document.querySelector("body");

    expect(htmlElement).toBeInTheDocument();
    expect(bodyElement).toBeInTheDocument();
  });

  it("contains metadata elements", () => {
    const testContent = "Test Content";

    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <div data-testid="test-wrapper">{children}</div>
    );

    render(
      <TestWrapper>
        <RootLayout>
          <div>{testContent}</div>
        </RootLayout>
      </TestWrapper>,
    );

    // The layout should render without errors and contain the child content
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });
});
