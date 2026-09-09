import { fireEvent, render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

function ThrowingChild(): never {
  throw new Error("expected test failure");
}

describe("ErrorBoundary", () => {
  it("keeps ordinary content intact", () => {
    render(
      <ErrorBoundary>
        <p>Safe content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("shows and invokes the recovery action after a child throws", () => {
    const reload = jest.fn();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <ErrorBoundary onReload={reload}>
          <ThrowingChild />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      const recoveryAction = screen.getByRole("button", { name: "Refresh Page" });
      fireEvent.click(recoveryAction);
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
