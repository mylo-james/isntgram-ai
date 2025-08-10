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
    const { auth } = require("@/lib/auth");
    auth.mockResolvedValue({
      user: { id: "1", username: "testuser", email: "test@example.com" },
    } as never);
  });

  it("renders profile page with valid username", async () => {
    const params = { username: "testuser" };

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
      expect(screen.getByTestId("username")).toHaveTextContent("testuser");
    });
  });

  it("calls notFound for empty username", async () => {
    const params = { username: "" };

    await UserProfilePage({ params });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound for whitespace-only username", async () => {
    const params = { username: "   " };

    await UserProfilePage({ params });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound for undefined username", async () => {
    const params = { username: undefined as never };

    await UserProfilePage({ params });

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("passes current user session to ProfilePage", async () => {
    const mockSession = {
      user: { id: "1", username: "currentuser", email: "current@example.com" },
    };
    const { auth } = require("@/lib/auth");
    auth.mockResolvedValue(mockSession as never);

    const params = { username: "testuser" };

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("currentuser");
    });
  });

  it("handles null session gracefully", async () => {
    const { auth } = require("@/lib/auth");
    auth.mockResolvedValue(null as never);

    const params = { username: "testuser" };

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("no-user");
    });
  });

  it("generates correct metadata", async () => {
    const params = { username: "testuser" };

    // Import the generateMetadata function directly
    const { generateMetadata } = await import("./page");

    const metadata = await generateMetadata({ params });

    expect(metadata).toEqual({
      title: "testuser - Profile | Isntgram",
      description: "View testuser's profile on Isntgram",
    });
  });
});
