// Mock NextAuth.js before importing
jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  useSession: jest.fn(),
}));

// Mock Next.js navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

// Mock fetch
const originalFetch = global.fetch;

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn();
    // Mock unauthenticated session
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
  });

  afterAll(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it("renders login form with required fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("renders a Try our demo button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /try our demo/i })).toBeInTheDocument();
  });

  it("clicking demo button calls backend demo endpoint then signs in", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    (global as unknown as { fetch: jest.Mock }).fetch.mockResolvedValue({ ok: true, status: 200 });

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));

    await waitFor(() => {
      expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(signIn).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows a generic error if demo backend call fails", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "some error" });
    (global as unknown as { fetch: jest.Mock }).fetch.mockResolvedValue({ ok: false, status: 500 });

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));

    await waitFor(() => {
      expect(screen.getByText(/demo sign-in failed/i)).toBeInTheDocument();
    });
  });

  it("shows validation errors for empty fields on submit", async () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/email/i);
    const form = emailInput.closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it("validates email format", async () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: "bad-email" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it("submits valid form and calls Auth.js signIn", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "password123",
        redirect: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });
  });

  it("renders success message from search params", async () => {
    // Override only for this test to provide a message param
    jest.doMock("next/navigation", () => ({
      useRouter: () => ({ push: mockPush }),
      useSearchParams: () => new URLSearchParams("message=Welcome%20back%21"),
    }));

    // Re-require after mocking
    const { default: LoginPageWithMessage } = await import("./page");

    render(<LoginPageWithMessage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    expect(screen.getByText(/logging in/i)).toBeInTheDocument();
  });

  it("handles authentication errors", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "Invalid credentials" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrongpassword" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("maps CredentialsSignin to a friendly error message", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrongpassword" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("maps Configuration error to a friendly message", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "Configuration" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/authentication configuration error/i)).toBeInTheDocument();
    });
  });

  it("redirects when already authenticated", async () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: { user: { id: "1", email: "a@b.com", name: "A B" } },
      status: "authenticated",
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });
});
