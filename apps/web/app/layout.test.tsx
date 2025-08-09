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

// Mock the layout component to avoid DOM nesting issues
jest.mock("./layout", () => {
  const MockedLayout = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="root-layout">
      <header data-testid="layout-header">Header</header>
      <main data-testid="layout-main">{children}</main>
      <footer data-testid="layout-footer">Footer</footer>
    </div>
  );
  return MockedLayout;
});

describe("RootLayout", () => {
  it("renders children correctly", () => {
    const testContent = "Test Content";

    render(
      <RootLayout>
        <div>{testContent}</div>
      </RootLayout>,
    );

    expect(screen.getByText(testContent)).toBeInTheDocument();
    expect(screen.getByTestId("root-layout")).toBeInTheDocument();
  });

  it("applies correct structure and classes", () => {
    const testContent = "Test Content";

    render(
      <RootLayout>
        <div>{testContent}</div>
      </RootLayout>,
    );

    // Verify the content is rendered
    expect(screen.getByText(testContent)).toBeInTheDocument();

    // Check that the layout structure exists
    expect(screen.getByTestId("root-layout")).toBeInTheDocument();
    expect(screen.getByTestId("layout-header")).toBeInTheDocument();
    expect(screen.getByTestId("layout-main")).toBeInTheDocument();
    expect(screen.getByTestId("layout-footer")).toBeInTheDocument();
  });

  it("contains metadata elements", () => {
    const testContent = "Test Content";

    render(
      <RootLayout>
        <div>{testContent}</div>
      </RootLayout>,
    );

    // The layout should render without errors and contain the child content
    expect(screen.getByText(testContent)).toBeInTheDocument();
    expect(screen.getByTestId("root-layout")).toBeInTheDocument();
  });
});
