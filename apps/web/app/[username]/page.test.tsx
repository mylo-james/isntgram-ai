import { render, screen, waitFor } from "@testing-library/react";
import { notFound } from "next/navigation";
import UserProfilePage from "./page";

// Mock dependencies
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("./ProfilePage", () => {
  return function MockProfilePage({
    username,
    currentUser,
  }: {
    username: string;
    currentUser?: { username: string } | null;
  }) {
    return (
      <div data-testid="profile-page">
        <span data-testid="username">{username}</span>
        <span data-testid="current-user">{currentUser?.username || "no-user"}</span>
      </div>
    );
  };
});

jest.mock("./ProfilePageSkeleton", () => {
  return function MockProfilePageSkeleton() {
    return <div data-testid="profile-skeleton">Loading...</div>;
  };
});

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

describe("UserProfilePage", () => {
  const mockNotFound = notFound as jest.MockedFunction<typeof notFound>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Match Next.js behavior: `notFound()` throws to stop rendering.
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    // Mock server-side fetch for initial profile data
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "1",
        username: "testuser",
        fullName: "Test User",
        postCount: 0,
        followerCount: 0,
        followingCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } as unknown as Response);

    const authModule = jest.requireMock("@/lib/auth");
    authModule.auth.mockResolvedValue({
      user: { id: "1", username: "testuser", email: "test@example.com" },
    } as never);
  });

  it("renders profile page with valid username", async () => {
    const params = Promise.resolve({ username: "testuser" });

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
      expect(screen.getByTestId("username")).toHaveTextContent("testuser");
    });
  });

  it("calls notFound for empty username", async () => {
    const params = Promise.resolve({ username: "" });

    await expect(UserProfilePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound for whitespace-only username", async () => {
    const params = Promise.resolve({ username: "   " });

    await expect(UserProfilePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound for undefined username", async () => {
    const params = Promise.resolve({ username: undefined as never });

    await expect(UserProfilePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("passes current user session to ProfilePage", async () => {
    const mockSession = {
      user: { id: "1", username: "currentuser", email: "current@example.com" },
    };
    const authModule = jest.requireMock("@/lib/auth");
    authModule.auth.mockResolvedValue(mockSession as never);

    const params = Promise.resolve({ username: "testuser" });

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("currentuser");
    });
  });

  it("handles null session gracefully", async () => {
    const authModule = jest.requireMock("@/lib/auth");
    authModule.auth.mockResolvedValue(null as never);

    const params = Promise.resolve({ username: "testuser" });

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("no-user");
    });
  });

  it("generates correct metadata", async () => {
    const params = Promise.resolve({ username: "testuser" });

    // Import the generateMetadata function directly
    const { generateMetadata } = await import("./page");

    const metadata = await generateMetadata({ params });

    expect(metadata).toEqual({
      title: "testuser - Profile | Isntgram",
      description: "View testuser's profile on Isntgram",
    });
  });
});
