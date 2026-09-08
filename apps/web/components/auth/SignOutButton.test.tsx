// Mock NextAuth.js before importing
jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    logout: jest.fn(),
  },
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignOutButton from "./SignOutButton";

describe("SignOutButton", () => {
  const mockSignOut = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const { signOut } = jest.requireMock("next-auth/react") as { signOut: jest.Mock };
    signOut.mockImplementation(mockSignOut);

    const { useRouter } = jest.requireMock("next/navigation") as { useRouter: jest.Mock };
    useRouter.mockReturnValue({ push: mockPush });

    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { logout: jest.Mock } };
    apiClient.logout.mockResolvedValue(undefined);
  });

  it("renders sign out button", () => {
    render(<SignOutButton />);
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("shows confirmation dialog when clicked", () => {
    render(<SignOutButton />);

    fireEvent.click(screen.getByText("Sign Out"));

    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("Yes, Sign Out")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls signOut and redirects when confirmed", async () => {
    mockSignOut.mockResolvedValue(undefined);

    render(<SignOutButton />);

    // Click sign out button
    fireEvent.click(screen.getByText("Sign Out"));

    // Click confirm
    fireEvent.click(screen.getByText("Yes, Sign Out"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({
        redirect: false,
        callbackUrl: "/login",
      });
    });

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("redirects even when signOut throws", async () => {
    mockSignOut.mockRejectedValue(new Error("boom"));

    render(<SignOutButton />);

    fireEvent.click(screen.getByText("Sign Out"));
    fireEvent.click(screen.getByText("Yes, Sign Out"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    expect(screen.queryByText("Yes, Sign Out")).not.toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("shows loading state during sign out", async () => {
    // Mock a slow sign out
    mockSignOut.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<SignOutButton />);

    // Click sign out button
    fireEvent.click(screen.getByText("Sign Out"));

    // Click confirm
    fireEvent.click(screen.getByText("Yes, Sign Out"));

    expect(screen.getByText("Signing out...")).toBeInTheDocument();
    // The button is disabled during loading
    const confirmButton = screen.getByText("Signing out...").closest("button");
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("hides confirmation dialog when cancelled", () => {
    render(<SignOutButton />);

    // Click sign out button
    fireEvent.click(screen.getByText("Sign Out"));

    // Click cancel
    fireEvent.click(screen.getByText("Cancel"));

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
    expect(screen.queryByText("Yes, Sign Out")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("applies custom class, secondary variant, and small size through Button", () => {
    render(<SignOutButton className="custom-class" variant="secondary" size="sm" />);
    const button = screen.getByText("Sign Out");
    expect(button).toHaveClass("custom-class", "ui-secondary", "px-3", "py-1.5", "text-sm");
  });
});
