import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
};
import ProfilePage from "./ProfilePage";
import { apiClient } from "@/lib/api-client";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    getUserProfile: jest.fn(),
  },
}));

jest.mock("./components/ProfileStats", () => {
  return function MockProfileStats({
    profile,
    variant,
  }: {
    profile: { postCount: number; followerCount: number; followingCount: number };
    variant?: "mobile" | "desktop";
  }) {
    const v = variant ?? "desktop";
    return (
      <div data-testid={`profile-stats-${v}`}>
        <span data-testid={`post-count-${v}`}>{profile.postCount}</span>
        <span data-testid={`follower-count-${v}`}>{profile.followerCount}</span>
        <span data-testid={`following-count-${v}`}>{profile.followingCount}</span>
      </div>
    );
  };
});

jest.mock("./components/ProfileActions", () => {
  return function MockProfileActions({
    currentUser,
    isOwnProfile,
    variant,
  }: {
    currentUser?: { username: string } | null;
    isOwnProfile: boolean;
    variant?: "mobile" | "desktop";
  }) {
    const v = variant ?? "desktop";
    return (
      <div data-testid={`profile-actions-${v}`}>
        <span data-testid={`is-own-profile-${v}`}>{isOwnProfile.toString()}</span>
        <span data-testid={`current-user-${v}`}>{currentUser?.username || "no-user"}</span>
      </div>
    );
  };
});

jest.mock("./components/ProfilePosts", () => {
  return function MockProfilePosts({ username }: { username: string }) {
    return <div data-testid="profile-posts">{username}</div>;
  };
});

jest.mock("@/components/common/ErrorBoundary", () => {
  return function MockErrorBoundary({ children }: { children: React.ReactNode }) {
    return <div data-testid="error-boundary">{children}</div>;
  };
});

jest.mock("./ProfilePageSkeleton", () => {
  return function MockProfilePageSkeleton() {
    return <div data-testid="profile-skeleton">Loading...</div>;
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
    } as never);
  });

  it("renders loading state initially", () => {
    mockApiClient.getUserProfile.mockImplementation(() => new Promise(() => {}));

    render(<ProfilePage username="testuser" currentUser={mockCurrentUser} />);

    expect(screen.getByTestId("profile-skeleton")).toBeInTheDocument();
  });

  it("renders profile data when fetch succeeds", async () => {
    mockApiClient.getUserProfile.mockResolvedValue(mockProfile);

    render(<ProfilePage username="testuser" currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByTestId("profile-stats-mobile")).toBeInTheDocument();
      expect(screen.getByTestId("profile-actions-mobile")).toBeInTheDocument();
    });

    expect(screen.getAllByText("testuser").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test bio").length).toBeGreaterThan(0);
    expect(screen.getByTestId("post-count-mobile")).toHaveTextContent("10");
    expect(screen.getByTestId("follower-count-mobile")).toHaveTextContent("100");
    expect(screen.getByTestId("following-count-mobile")).toHaveTextContent("50");
  });

  it("shows error state when fetch fails", async () => {
    mockApiClient.getUserProfile.mockRejectedValue(new Error("User not found"));

    render(<ProfilePage username="testuser" currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText("User Not Found")).toBeInTheDocument();
      expect(screen.getByText('The user "testuser" could not be found.')).toBeInTheDocument();
    });
  });

  it("shows error state when profile is null", async () => {
    mockApiClient.getUserProfile.mockResolvedValue(null as never);

    render(<ProfilePage username="testuser" currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText("User Not Found")).toBeInTheDocument();
    });
  });

  it("navigates to home when Go Home button is clicked", async () => {
    mockApiClient.getUserProfile.mockRejectedValue(new Error("User not found"));

    render(<ProfilePage username="testuser" currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText("Go Home")).toBeInTheDocument();
    });

    screen.getByText("Go Home").click();

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("correctly identifies own profile", async () => {
    mockApiClient.getUserProfile.mockResolvedValue(mockProfile);

    render(<ProfilePage username="testuser" currentUser={{ ...mockCurrentUser, username: "testuser" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("is-own-profile-mobile")).toHaveTextContent("true");
    });
  });

  it("correctly identifies other user profile", async () => {
    mockApiClient.getUserProfile.mockResolvedValue(mockProfile);

    render(<ProfilePage username="testuser" currentUser={{ ...mockCurrentUser, username: "otheruser" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("is-own-profile-mobile")).toHaveTextContent("false");
    });
  });

  it("handles null current user", async () => {
    mockApiClient.getUserProfile.mockResolvedValue(mockProfile);

    render(<ProfilePage username="testuser" currentUser={null} />);

    await waitFor(() => {
      expect(screen.getByTestId("current-user-mobile")).toHaveTextContent("no-user");
    });
  });

  it("refetches profile when username changes", async () => {
    mockApiClient.getUserProfile.mockResolvedValue(mockProfile);

    const { rerender } = render(<ProfilePage username="testuser" currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(mockApiClient.getUserProfile).toHaveBeenCalledWith("testuser");
    });

    mockApiClient.getUserProfile.mockClear();

    rerender(<ProfilePage username="newuser" currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(mockApiClient.getUserProfile).toHaveBeenCalledWith("newuser");
    });
  });
});
