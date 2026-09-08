import { fireEvent, render, screen } from "@testing-library/react";
import PageError from "./error";
import NotFound from "./not-found";
import Loading from "./loading";
it("recovers a failed page through reset without disclosing internal diagnostics", () => {
  const reset = jest.fn();
  render(<PageError error={new Error("Database secret")} reset={reset} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page couldn’t load");
  expect(screen.queryByText("Database secret")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry page" }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/feed");
});
it("distinguishes missing content and offers two valid destinations", () => {
  render(<NotFound />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  expect(screen.getByRole("link", { name: "Find people" })).toHaveAttribute("href", "/explore");
});
it("announces page loading once while the eight-circle mark is decorative", () => {
  const view = render(<Loading />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent("Loading page…");
  expect(view.container.querySelector(".circle-loader")).toHaveAttribute("aria-hidden", "true");
  expect(view.container.querySelectorAll(".circle-loader-dot")).toHaveLength(8);
});
