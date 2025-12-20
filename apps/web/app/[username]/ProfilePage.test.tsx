import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import type { Session } from "next-auth";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

const mockApiClient = {
  getUserPosts: jest.fn(),
  getFollowStatus: jest.fn(),
};

jest.mock("@/lib/api-client", () => ({
  __esModule: true,
  apiClient: mockApiClient,
}));

jest.mock("@/components/posts/PostCard", () => {
  return function MockPostCard({ post }: { post: { id: string; content: string } }) {
    return (
      <div data-testid="post-card" data-post-id={post.id}>
        {post.content}
      </div>
    );
  };
});

jest.mock("./components/ProfileHeader", () => {
  return function MockProfileHeader({ profile }: { profile: { username: string; fullName: string } }) {
    return (
      <div data-testid="profile-header">
        <span data-testid="profile-username">{profile.username}</span>
        <span data-testid="profile-fullname">{profile.fullName}</span>
      </div>
    );
  };
});

jest.mock("./components/ProfileStats", () => {
  return function MockProfileStats({
    profile,
  }: {
    profile: { postCount: number; followerCount: number; followingCount: number };
  }) {
    return (
      <div data-testid="profile-stats">
        <span data-testid="post-count">{profile.postCount}</span>
        <span data-testid="follower-count">{profile.followerCount}</span>
        <span data-testid="following-count">{profile.followingCount}</span>
      </div>
    );
  };
});

jest.mock("./components/ProfileActions", () => {
  return function MockProfileActions({
    currentUser,
    isOwnProfile,
    isFollowing,
    onProfileUpdated,
    onFollowChange,
  }: {
    currentUser?: { username: string } | null;
    isOwnProfile: boolean;
    isFollowing: boolean | null;
    onProfileUpdated: (updated: { fullName: string; username: string }) => void;
    onFollowChange: (next: boolean) => void;
  }) {
    return (
      <div data-testid="profile-actions">
        <span data-testid="is-own-profile">{isOwnProfile.toString()}</span>
        <span data-testid="current-user">{currentUser?.username || "no-user"}</span>
        <span data-testid="is-following">{String(isFollowing)}</span>
        <button type="button" onClick={() => onProfileUpdated({ fullName: "Updated Name", username: "updated" })}>
          Trigger profile update
        </button>
        <button type="button" onClick={() => onFollowChange(true)}>
          Trigger follow
        </button>
        <button type="button" onClick={() => onFollowChange(false)}>
          Trigger unfollow
        </button>
      </div>
    );
  };
});

jest.mock("@/components/common/ErrorBoundary", () => {
  return function MockErrorBoundary({ children }: { children: React.ReactNode }) {
    return <div data-testid="error-boundary">{children}</div>;
  };
});

interface AppSession extends Session {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
}

let ProfilePage: typeof import("./ProfilePage").default;
let mockUseRouter: jest.Mock;

beforeAll(async () => {
  ProfilePage = (await import("./ProfilePage")).default;
});

const flushEffects = async () => {
  const pending = [
    ...mockApiClient.getUserPosts.mock.results.map((result) => result.value),
    ...mockApiClient.getFollowStatus.mock.results.map((result) => result.value),
  ].filter(Boolean);

  await act(async () => {
    await Promise.allSettled(pending.map((promise) => Promise.resolve(promise)));
    await Promise.resolve();
  });
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ProfilePage", () => {
  const mockPush = jest.fn();
  const mockCurrentUser: AppSession["user"] = {
    id: "1",
    username: "currentuser",
    email: "current@example.com",
  };

  const mockProfile = {
    id: "1",
    username: "testuser",
    fullName: "Test User",
    profilePictureUrl: "https://example.com/avatar.jpg",
    bio: "Test bio",
    postCount: 10,
    followerCount: 100,
    followingCount: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAuthor = {
    id: mockProfile.id,
    username: mockProfile.username,
    fullName: mockProfile.fullName,
    profilePictureUrl: mockProfile.profilePictureUrl ?? undefined,
  };

  const createPost = (id: string, content: string) => ({
    id,
    content,
    mediaUrl: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: mockAuthor,
  });

  const baseProps = {
    username: "testuser",
    currentUser: mockCurrentUser,
    initialProfile: mockProfile,
    initialPosts: [] as Array<ReturnType<typeof createPost>>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter = (jest.requireMock("next/navigation") as { useRouter: jest.Mock }).useRouter;
    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as never);
    mockApiClient.getUserPosts.mockResolvedValue({ items: [], nextCursor: undefined });
    mockApiClient.getFollowStatus.mockResolvedValue({ isFollowing: false });
  });

  it("renders not found state when initial profile is null and navigates home", async () => {
    render(<ProfilePage username="testuser" currentUser={null} initialProfile={null as never} initialPosts={[]} />);

    expect(screen.getByText("User Not Found")).toBeInTheDocument();
    expect(screen.getByText('The user "testuser" could not be found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go home/i }));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("renders profile data and posts from initial props", async () => {
    render(<ProfilePage {...baseProps} initialPosts={[createPost("p1", "First post")]} initialIsFollowing={true} />);

    await waitFor(() => expect(screen.getByTestId("profile-header")).toBeInTheDocument());
    expect(screen.getByTestId("profile-username")).toHaveTextContent("testuser");
    expect(screen.getByTestId("profile-fullname")).toHaveTextContent("Test User");
    expect(screen.getByTestId("post-count")).toHaveTextContent("10");
    expect(screen.getByTestId("follower-count")).toHaveTextContent("100");
    expect(screen.getByTestId("following-count")).toHaveTextContent("50");
    expect(screen.getByTestId("is-following")).toHaveTextContent("true");
    expect(screen.getByText("First post")).toBeInTheDocument();

    expect(mockApiClient.getFollowStatus).not.toHaveBeenCalled();
  });

  it("fetches follow status when not own profile and initialIsFollowing is null", async () => {
    mockApiClient.getFollowStatus.mockResolvedValueOnce({ isFollowing: true });

    render(
      <ProfilePage
        {...baseProps}
        currentUser={{ ...mockCurrentUser, id: "2", username: "someone-else" }}
        initialIsFollowing={null}
      />,
    );

    await waitFor(() => expect(mockApiClient.getFollowStatus).toHaveBeenCalledWith("testuser"));
    await waitFor(() => expect(screen.getByTestId("is-following")).toHaveTextContent("true"));
  });

  it("does not fetch follow status for own profile", async () => {
    render(
      <ProfilePage
        {...baseProps}
        currentUser={{ ...mockCurrentUser, username: "testuser" }}
        initialIsFollowing={null}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("is-own-profile")).toHaveTextContent("true"));
    expect(mockApiClient.getFollowStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId("is-following")).toHaveTextContent("null");
  });

  it("loads more posts when nextCursor is present", async () => {
    mockApiClient.getUserPosts.mockResolvedValueOnce({
      items: [createPost("p2", "Second post")],
      nextCursor: undefined,
    } as never);

    render(<ProfilePage {...baseProps} initialPosts={[createPost("p1", "First post")]} initialCursor="cursor-1" />);

    const loadMore = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMore);

    await waitFor(() =>
      expect(mockApiClient.getUserPosts).toHaveBeenLastCalledWith("testuser", { cursor: "cursor-1" }),
    );
    await waitFor(() => expect(screen.getByText("Second post")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows loading state when loading more posts from empty feed", async () => {
    const deferred = createDeferred<{ items: Array<{ id: string; content: string }>; nextCursor?: string }>();
    mockApiClient.getUserPosts.mockReturnValueOnce(deferred.promise as never);

    render(<ProfilePage {...baseProps} initialPosts={[]} initialCursor="cursor-1" />);

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(screen.getByText(/loading posts/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();

    await act(async () => {
      deferred.resolve({ items: [], nextCursor: undefined });
    });

    await waitFor(() => expect(screen.getByText(/no posts yet/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows an error message when loading more posts fails", async () => {
    mockApiClient.getUserPosts.mockRejectedValueOnce(new Error("More posts failed"));

    render(<ProfilePage {...baseProps} initialPosts={[createPost("p1", "First post")]} initialCursor="cursor-1" />);

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => expect(screen.getByText(/more posts failed/i)).toBeInTheDocument());
  });

  it("falls back to a generic error when loading more posts throws a non-Error", async () => {
    mockApiClient.getUserPosts.mockRejectedValueOnce("nope");

    render(<ProfilePage {...baseProps} initialPosts={[createPost("p1", "First post")]} initialCursor="cursor-1" />);

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => expect(screen.getByText(/failed to load posts/i)).toBeInTheDocument());
  });

  it("updates profile state when ProfileActions triggers onProfileUpdated", async () => {
    render(<ProfilePage {...baseProps} />);

    await waitFor(() => expect(screen.getByTestId("profile-fullname")).toHaveTextContent("Test User"));
    fireEvent.click(screen.getByRole("button", { name: /trigger profile update/i }));
    await waitFor(() => expect(screen.getByTestId("profile-fullname")).toHaveTextContent("Updated Name"));
    await waitFor(() => expect(screen.getByTestId("profile-username")).toHaveTextContent("updated"));
  });

  it("updates follower count when ProfileActions triggers onFollowChange", async () => {
    render(<ProfilePage {...baseProps} initialProfile={{ ...mockProfile, followerCount: 0 }} />);

    await waitFor(() => expect(screen.getByTestId("follower-count")).toHaveTextContent("0"));
    fireEvent.click(screen.getByRole("button", { name: /trigger unfollow/i }));
    await waitFor(() => expect(screen.getByTestId("follower-count")).toHaveTextContent("0"));

    fireEvent.click(screen.getByRole("button", { name: /trigger follow/i }));
    await waitFor(() => expect(screen.getByTestId("follower-count")).toHaveTextContent("1"));
  });

  it("updates profile and posts when initial props change", async () => {
    const { rerender } = render(<ProfilePage {...baseProps} />);

    await waitFor(() => expect(screen.getByTestId("profile-username")).toHaveTextContent("testuser"));
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();

    rerender(
      <ProfilePage
        {...baseProps}
        username="newuser"
        initialProfile={{ ...mockProfile, username: "newuser", fullName: "New Name" }}
        initialPosts={[createPost("p2", "Updated post")]}
        initialCursor="next"
        initialIsFollowing={false}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("profile-username")).toHaveTextContent("newuser"));
    expect(screen.getByTestId("profile-fullname")).toHaveTextContent("New Name");
    expect(screen.getByText("Updated post")).toBeInTheDocument();
    expect(screen.getByTestId("is-following")).toHaveTextContent("false");
  });

  afterEach(async () => {
    await flushEffects();
  });
});
