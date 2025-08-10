// Mock NextAuth.js before importing
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

import { render, screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";

describe("ProtectedRoute", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const { useRouter } = jest.requireMock("next/navigation") as { useRouter: jest.Mock };
    useRouter.mockReturnValue({ push: mockPush });
  });

  it("renders children when user is authenticated", () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: { user: { id: "1", email: "test@example.com" } },
      status: "authenticated",
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("shows loading state when session is loading", () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("shows redirect message when user is unauthenticated", () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Redirecting to login...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to login when user is unauthenticated", () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("renders custom fallback when provided", () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    render(
      <ProtectedRoute fallback={<div>Custom Loading...</div>}>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Custom Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("does not redirect when session is loading", () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(mockPush).not.toHaveBeenCalled();
  });
});
