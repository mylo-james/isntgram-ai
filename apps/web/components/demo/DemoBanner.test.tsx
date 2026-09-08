import { act, fireEvent, render, screen } from "@testing-library/react";
import { signOut, useSession } from "next-auth/react";
import DemoBanner from "./DemoBanner";

jest.mock("next-auth/react", () => ({ signOut: jest.fn(), useSession: jest.fn() }));

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  readonly observe = jest.fn();
  readonly disconnect = jest.fn();
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    TestResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const demoSession = (expiresAt?: string) => ({
  user: { isDemoUser: true, demoExpiresAt: expiresAt },
});

describe("DemoBanner", () => {
  const originalResizeObserver = global.ResizeObserver;
  const originalSource = process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
    jest.resetAllMocks();
    TestResizeObserver.instances = [];
    Object.assign(global, { ResizeObserver: TestResizeObserver });
    window.localStorage.clear();
    (useSession as jest.Mock).mockReturnValue({ data: demoSession("2026-09-08T12:01:01.000Z") });
    process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE = "curated";
    document.documentElement.style.removeProperty("--demo-banner-height");
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.assign(global, { ResizeObserver: originalResizeObserver });
    if (originalSource === undefined) delete process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE;
    else process.env.NEXT_PUBLIC_DEMO_CONTENT_SOURCE = originalSource;
  });

  it("stays hidden for an ordinary session", async () => {
    (useSession as jest.Mock).mockReturnValue({ data: { user: { isDemoUser: false } } });
    render(<DemoBanner />);

    await act(async () => {});
    expect(screen.queryByText(/demo session/i)).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--demo-banner-height")).toBe("0px");
  });

  it("renders curated disclosure, measures layout, persists dismissal, and cleans up", async () => {
    window.localStorage.setItem("isntgram.demoBannerDismissed.v1", "false");
    const { container, unmount } = render(<DemoBanner />);
    const banner = await screen.findByText(/demo session expires in 1m/i);
    const root = container.firstElementChild as HTMLDivElement;
    Object.defineProperty(root, "offsetHeight", { configurable: true, value: 44 });

    act(() => TestResizeObserver.instances[0].trigger());
    expect(document.documentElement.style.getPropertyValue("--demo-banner-height")).toBe("44px");
    expect(screen.getByText(/fictional profiles and credited photographs/i)).toBeInTheDocument();
    expect(banner).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(window.localStorage.getItem("isntgram.demoBannerDismissed.v1")).toBe("true");
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--demo-banner-height")).toBe("0px");

    unmount();
    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows the demo disclosure when dismissal storage cannot be read", async () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    try {
      render(<DemoBanner />);
      act(() => jest.runAllTicks());
      expect(screen.getByText(/fictional profiles and credited photographs/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled();
    } finally {
      getItem.mockRestore();
    }
  });

  it("keeps a persisted dismissal hidden on a fresh mount", async () => {
    window.localStorage.setItem("isntgram.demoBannerDismissed.v1", "true");

    render(<DemoBanner />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("formats day/hour expiry and falls back to a neutral title for invalid expiry", async () => {
    window.localStorage.setItem("isntgram.demoBannerDismissed.v1", "false");
    (useSession as jest.Mock).mockReturnValue({ data: demoSession("2026-09-09T14:00:00.000Z") });
    const view = render(<DemoBanner />);
    expect(await screen.findByText(/demo session expires in 1d 2h/i)).toBeInTheDocument();

    (useSession as jest.Mock).mockReturnValue({ data: demoSession("not-a-date") });
    view.rerender(<DemoBanner />);
    expect(await screen.findByText("Demo session")).toBeInTheDocument();
  });

  it("clears the demo countdown interval when unmounted", async () => {
    window.localStorage.setItem("isntgram.demoBannerDismissed.v1", "false");
    const clear = jest.spyOn(global, "clearInterval");
    const view = render(<DemoBanner />);
    await screen.findByRole("button", { name: "Dismiss" });

    view.unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it("allows dismissal when persistence fails", async () => {
    window.localStorage.setItem("isntgram.demoBannerDismissed.v1", "false");
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(<DemoBanner />);
    await screen.findByRole("button", { name: "Dismiss" });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    setItem.mockRestore();
  });

  it("updates countdown boundaries and signs out once expired", async () => {
    window.localStorage.setItem("isntgram.demoBannerDismissed.v1", "false");
    render(<DemoBanner />);
    await screen.findByText(/demo session expires in 1m/i);

    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText(/demo session expires in moments/i)).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText("Demo session expired")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });
});
