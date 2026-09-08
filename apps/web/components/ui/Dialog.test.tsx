import { act, fireEvent, render, screen } from "@testing-library/react";
import Dialog from "./Dialog";

describe("Dialog", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("moves focus, closes with Escape and restores the opener", () => {
    const close = jest.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { rerender } = render(
      <Dialog open onClose={close} aria-label="Options">
        <button>First</button>
        <button>Last</button>
      </Dialog>,
    );
    act(() => jest.runAllTimers());
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);

    rerender(
      <Dialog open={false} onClose={close} aria-label="Options">
        <button>First</button>
        <button>Last</button>
      </Dialog>,
    );
    expect(opener).toHaveFocus();
    document.body.removeChild(opener);
  });

  it("honors overlay close policy and wraps Tab focus", () => {
    const close = jest.fn();
    const { rerender } = render(
      <Dialog open onClose={close} aria-label="Options">
        <button>First</button>
        <button>Last</button>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    expect(close).toHaveBeenCalledTimes(1);

    rerender(
      <Dialog open onClose={close} closeOnOverlayClick={false} aria-label="Options">
        <button>First</button>
        <button>Last</button>
      </Dialog>,
    );
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(close).toHaveBeenCalledTimes(1);

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });
});
