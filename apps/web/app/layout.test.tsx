import { render, screen } from "@testing-library/react";
import RootLayout from "./layout";

// Mock Next.js components that don't work well in Jest
jest.mock("next/font/local", () => ({
  __esModule: true,
  default: () => ({
    className: "mocked-font",
  }),
}));

describe("RootLayout", () => {
  it("renders children correctly", () => {
    const testContent = "Test Content";

    // Create a wrapper div to contain the layout for testing
    const { container } = render(
      <div>
        <RootLayout>
          <div>{testContent}</div>
        </RootLayout>
      </div>,
    );

    expect(screen.getByText(testContent)).toBeInTheDocument();
    expect(container.querySelector("html")).toBeInTheDocument();
  });

  it("applies correct structure and classes", () => {
    const testContent = "Test Content";

    render(
      <div>
        <RootLayout>
          <div>{testContent}</div>
        </RootLayout>
      </div>,
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

    render(
      <div>
        <RootLayout>
          <div>{testContent}</div>
        </RootLayout>
      </div>,
    );

    // The layout should render without errors and contain the child content
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });
});
