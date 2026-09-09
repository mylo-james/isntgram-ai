import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NotificationItem } from "@isntgram-ai/shared-types";
import { ApiRequestError } from "@/lib/api-error";

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    getNotifications: jest.fn(),
  },
}));

import NotificationsClient from "./NotificationsClient";

const { apiClient: mockApiClient } = jest.requireMock("@/lib/api-client") as {
  apiClient: { getNotifications: jest.Mock };
};

function notification(id: string, type: NotificationItem["type"] = "like", postId?: string): NotificationItem {
  return {
    id,
    type,
    createdAt: "2026-09-07T12:00:00.000Z",
    actor: {
      id: `actor-${id}`,
      username: `actor-${id}`,
      fullName: `Actor ${id}`,
    },
    postId,
  };
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  disconnect = jest.fn();
  observe = jest.fn();

  trigger() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

describe("NotificationsClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockIntersectionObserver.instances = [];
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: MockIntersectionObserver });
  });

  afterEach(() => Reflect.deleteProperty(window, "IntersectionObserver"));

  it("keeps an initial load failure distinct from an empty inbox and retries it", async () => {
    mockApiClient.getNotifications.mockResolvedValueOnce({
      items: [notification("first")],
      nextCursor: undefined,
    });
    render(<NotificationsClient initialNotifications={{ items: [], nextCursor: undefined }} initialLoadError />);

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn’t load your notifications/i);
    expect(screen.queryByText(/no notifications yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry notifications/i }));
    await waitFor(() => expect(screen.getByText("actor-first")).toBeInTheDocument());
    expect(mockApiClient.getNotifications).toHaveBeenCalledWith(undefined);
  });

  it("retains earlier items and stops automatic retries when a later observer page fails", async () => {
    const first = notification("first", "follow");
    mockApiClient.getNotifications.mockRejectedValueOnce(new Error("offline"));
    render(<NotificationsClient initialNotifications={{ items: [first], nextCursor: "cursor-2" }} />);

    await act(async () => {
      MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]?.trigger();
      MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]?.trigger();
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/earlier notifications are still here/i));
    expect(mockApiClient.getNotifications).toHaveBeenCalledTimes(1);
    await act(async () => MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]?.trigger());
    expect(mockApiClient.getNotifications).toHaveBeenCalledTimes(1);

    expect(screen.getByText("actor-first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry load more/i })).toBeEnabled();

    mockApiClient.getNotifications.mockResolvedValueOnce({
      items: [notification("second", "comment", "post-2")],
      nextCursor: undefined,
    });
    fireEvent.click(screen.getByRole("button", { name: /retry load more/i }));

    await waitFor(() => expect(screen.getByText("actor-second")).toBeInTheDocument());
    expect(mockApiClient.getNotifications).toHaveBeenNthCalledWith(1, { cursor: "cursor-2" });
    expect(mockApiClient.getNotifications).toHaveBeenNthCalledWith(2, { cursor: "cursor-2" });
  });

  it("retains notifications and exposes session recovery when pagination rejects the session", async () => {
    mockApiClient.getNotifications.mockRejectedValueOnce(new ApiRequestError("Unauthorized", 401));
    render(<NotificationsClient initialNotifications={{ items: [notification("first")], nextCursor: "cursor-2" }} />);
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your session has expired"));
    expect(screen.getByText("actor-first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in (new tab)" })).toHaveAttribute("href", "/login?reauth=1");
    expect(screen.getByRole("button", { name: /retry load more/i })).toBeEnabled();
  });

  it("keeps page order while deduplicating repeated notification IDs", async () => {
    const first = notification("first");
    const second = notification("second", "comment", "post-2");
    const third = notification("third", "follow");
    mockApiClient.getNotifications.mockResolvedValueOnce({
      items: [first, second, third],
      nextCursor: undefined,
    });
    render(<NotificationsClient initialNotifications={{ items: [first], nextCursor: "cursor-2" }} />);

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() => expect(screen.getByText("actor-third")).toBeInTheDocument());

    expect(screen.getAllByText("actor-first")).toHaveLength(1);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("actor-first"),
      expect.stringContaining("actor-second"),
      expect.stringContaining("actor-third"),
    ]);
  });

  it("links follow to the actor and post activity to its post target", () => {
    render(
      <NotificationsClient
        initialNotifications={{
          items: [
            notification("follow", "follow"),
            notification("like", "like", "post-like"),
            notification("comment", "comment", "post-comment"),
          ],
          nextCursor: undefined,
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /actor-follow/i })).toHaveAttribute("href", "/actor-follow");
    expect(screen.getByRole("link", { name: /actor-like/i })).toHaveAttribute("href", "/post/post-like");
    expect(screen.getByRole("link", { name: /actor-comment/i })).toHaveAttribute("href", "/post/post-comment");
  });
});
