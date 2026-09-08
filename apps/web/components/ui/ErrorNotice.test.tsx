import { fireEvent, render, screen } from "@testing-library/react";
import ErrorNotice from "./ErrorNotice";
import { userError } from "@/lib/user-error";
import { ApiRequestError } from "@/lib/api-error";

describe("recoverable errors", () => {
  it("dismisses the message without losing retry, field association or recovery status", () => {
    const retry = jest.fn();
    const { rerender } = render(
      <ErrorNotice id="error" message="Could not publish" onRetry={retry} persistentSummary="Still unconfirmed" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Still unconfirmed");
    expect(screen.getByLabelText("Action recovery")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(<ErrorNotice message="Could not publish" onRetry={retry} pending />);
    expect(screen.getByRole("button", { name: "Trying again…" })).toBeDisabled();
  });
  it("preserves field guidance after dismissing a validation summary", () => {
    render(<ErrorNotice id="field-error" message="Choose another username" />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(document.getElementById("field-error")).toHaveTextContent("Choose another username");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("offers a new-tab login that leaves the current draft on screen", () => {
    const message = userError(new ApiRequestError("Internal auth detail", 401), "Fallback");
    render(<ErrorNotice message={message} />);
    expect(screen.getByRole("link", { name: "Log in (new tab)" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link")).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Internal auth detail");
  });
  it.each([
    [403, /permission/],
    [429, /wait a moment/i],
    [500, /Try the action again/],
  ])("maps status %s to actionable copy", (status, expected) => {
    expect(userError(new ApiRequestError("Internal diagnostic", status as number), "Try the action again")).toMatch(
      expected as RegExp,
    );
  });
  it("uses task-specific copy for network and unexpected errors", () => {
    expect(userError(new TypeError("Network internals"), "Your draft is still here. Retry.")).toBe(
      "Your draft is still here. Retry.",
    );
  });
});
