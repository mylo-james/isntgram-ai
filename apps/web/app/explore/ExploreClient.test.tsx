import { TextEncoder } from "node:util";

Object.assign(globalThis, { TextEncoder });

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PostItem } from "@/lib/api-client";

const mockSearchUsers = jest.fn();
const mockGetExplore = jest.fn();

jest.mock("@/lib/api-client", () => ({
  __esModule: true,
  apiClient: {
    getExplore: (...args: unknown[]) => mockGetExplore(...args),
    searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
  },
}));

import ExploreClient from "./ExploreClient";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }

  disconnect = jest.fn();
  observe = jest.fn();
  takeRecords = jest.fn(() => []);
  unobserve = jest.fn();

  trigger() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function post(id: string, mediaUrl?: string): PostItem {
  return {
    id,
    content: `Post ${id}`,
    mediaUrl,
    likeCount: 0,
    commentCount: 0,
    previewComments: [],
    likedByViewer: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    author: { id: "author-1", username: "author", fullName: "Author" },
  };
}

describe("ExploreClient search", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    MockIntersectionObserver.instances = [];
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: MockIntersectionObserver,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps search disabled in server markup until hydration", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(<ExploreClient initialItems={[]} />);

    expect(markup).toMatch(/name="search"[^>]*disabled/);
    expect(markup).toContain("Preparing search…");
  });

  it("enables search after mount without requesting results", async () => {
    render(<ExploreClient initialItems={[]} />);

    const status = screen.getByRole("status");
    await waitFor(() => expect(screen.getByRole("textbox", { name: /search users/i })).toBeEnabled());
    expect(screen.getByRole("status")).toBe(status);
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it("commits only the latest search response", async () => {
    const first = deferred<{ items: Array<{ id: string; username: string; fullName: string }> }>();
    const second = deferred<{ items: Array<{ id: string; username: string; fullName: string }> }>();
    mockSearchUsers.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<ExploreClient initialItems={[]} />);

    const input = screen.getByRole("textbox", { name: /search users/i });
    fireEvent.change(input, { target: { value: "old" } });
    await act(async () => jest.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: "new" } });
    await act(async () => jest.advanceTimersByTime(200));

    await act(async () => second.resolve({ items: [{ id: "new", username: "newuser", fullName: "New User" }] }));
    await waitFor(() => expect(screen.getByText("newuser")).toBeInTheDocument());

    await act(async () => first.resolve({ items: [{ id: "old", username: "olduser", fullName: "Old User" }] }));
    expect(screen.queryByText("olduser")).not.toBeInTheDocument();
  });

  it("distinguishes loading, empty, and failed searches", async () => {
    const pending = deferred<{ items: Array<{ id: string; username: string; fullName: string }> }>();
    mockSearchUsers.mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("offline"));
    render(<ExploreClient initialItems={[]} />);

    const status = screen.getByRole("status");
    const input = screen.getByRole("textbox", { name: /search users/i });
    fireEvent.change(input, { target: { value: "none" } });
    await act(async () => jest.advanceTimersByTime(200));
    expect(status).toHaveTextContent(/searching/i);

    await act(async () => pending.resolve({ items: [] }));
    await waitFor(() => expect(status).toHaveTextContent(/no results/i));
    expect(screen.getByRole("status")).toBe(status);

    fireEvent.change(input, { target: { value: "failure" } });
    await act(async () => jest.advanceTimersByTime(200));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/search failed/i));
  });

  it("announces the returned search result count without making the result links a live region", async () => {
    mockSearchUsers.mockResolvedValueOnce({
      items: [
        { id: "one", username: "one", fullName: "One User" },
        { id: "two", username: "two", fullName: "Two User" },
      ],
    });
    render(<ExploreClient initialItems={[]} />);

    const status = screen.getByRole("status");
    fireEvent.change(screen.getByRole("textbox", { name: /search users/i }), { target: { value: "on" } });
    await act(async () => jest.advanceTimersByTime(200));

    await waitFor(() => expect(status).toHaveTextContent("2 results available."));
    expect(screen.getByRole("status")).toBe(status);
    expect(screen.getByRole("link", { name: "one One User" }).closest("ul")).not.toHaveAttribute("aria-live");
  });

  it("excludes media-less records and appends a sentinel page through the visible terminal state", async () => {
    mockGetExplore.mockResolvedValueOnce({ items: [post("two", "/two.jpg")], nextCursor: undefined });

    render(<ExploreClient initialItems={[post("one", "/one.jpg"), post("text-only")]} initialCursor="next-page" />);

    expect(screen.getByRole("link", { name: "View post 1" })).toHaveAttribute("href", "/post/one");
    expect(screen.queryByRole("link", { name: "View post 2" })).not.toBeInTheDocument();

    await act(async () => MockIntersectionObserver.instances[0].trigger());

    await waitFor(() => expect(mockGetExplore).toHaveBeenCalledWith({ cursor: "next-page" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "View post 2" })).toHaveAttribute("href", "/post/two"));
    expect(screen.getByText("Yay! You have seen it all")).toBeInTheDocument();
  });

  it("retains prior explore tiles and exposes a page error when a sentinel page fails", async () => {
    mockGetExplore.mockRejectedValueOnce(new Error("Explore page failed"));
    render(<ExploreClient initialItems={[post("one", "/one.jpg")]} initialCursor="next-page" />);

    await act(async () => MockIntersectionObserver.instances[0].trigger());

    await waitFor(() => expect(screen.getByText("Explore page failed")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "View post 1" })).toHaveAttribute("href", "/post/one");
  });
});
