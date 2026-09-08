import { act, fireEvent, render, screen } from "@testing-library/react";

import Brand from "./Brand";

type MotionPreference = {
  matches: boolean;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};

function motionPreference(matches = false): MotionPreference {
  return { matches, addEventListener: jest.fn(), removeEventListener: jest.fn() };
}

describe("Brand", () => {
  let preference: MotionPreference;

  beforeEach(() => {
    jest.useFakeTimers();
    preference = motionPreference();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => preference),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("finishes the active four-second cycle after pointer exit", () => {
    render(<Brand />);
    const brand = screen.getByRole("link", { name: "Isntgram home" });

    fireEvent.pointerEnter(brand, { pointerType: "mouse" });
    expect(brand).toHaveAttribute("data-animating", "true");
    fireEvent.pointerLeave(brand);

    act(() => jest.advanceTimersByTime(3999));
    expect(brand).toHaveAttribute("data-animating", "true");
    act(() => jest.advanceTimersByTime(1));
    expect(brand).toHaveAttribute("data-animating", "false");
  });

  it("continues cycling while hovered or keyboard-focused", () => {
    render(<Brand />);
    const brand = screen.getByRole("link", { name: "Isntgram home" });
    Object.defineProperty(brand, "matches", {
      configurable: true,
      value: (selector: string) => selector === ":focus-visible",
    });

    fireEvent.pointerEnter(brand, { pointerType: "mouse" });
    act(() => jest.advanceTimersByTime(8000));
    expect(brand).toHaveAttribute("data-animating", "true");

    fireEvent.pointerLeave(brand);
    fireEvent.focus(brand);
    act(() => jest.advanceTimersByTime(4000));
    expect(brand).toHaveAttribute("data-animating", "true");

    fireEvent.blur(brand);
    act(() => jest.advanceTimersByTime(4000));
    expect(brand).toHaveAttribute("data-animating", "false");
  });

  it("does not animate when reduced motion is requested", () => {
    preference.matches = true;
    render(<Brand />);
    const brand = screen.getByRole("link", { name: "Isntgram home" });

    fireEvent.pointerEnter(brand, { pointerType: "mouse" });
    expect(brand).toHaveAttribute("data-animating", "false");
  });

  it("still renders and responds to hover when matchMedia is unavailable", () => {
    Reflect.deleteProperty(window, "matchMedia");
    render(<Brand />);
    const brand = screen.getByRole("link", { name: "Isntgram home" });

    fireEvent.pointerEnter(brand, { pointerType: "mouse" });
    expect(brand).toHaveAttribute("data-animating", "true");
  });
});
