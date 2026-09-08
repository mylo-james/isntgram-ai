import { TextEncoder } from "node:util";

Object.assign(globalThis, { TextEncoder });

// Mock NextAuth.js before importing
jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  useSession: jest.fn(),
}));

// Mock Next.js navigation
const mockPush = jest.fn();
const mockSearchParams = jest.fn(() => new URLSearchParams());
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams(),
}));

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import LoginPage from "./page";

// Mock fetch
const originalFetch = global.fetch;

describe("LoginPage", () => {
  const originalDemoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn();
    mockSearchParams.mockReturnValue(new URLSearchParams());
    process.env.NEXT_PUBLIC_DEMO_ENABLED = "true";
    // Mock unauthenticated session
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
  });

  afterAll(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    if (originalDemoEnabled === undefined) {
      delete process.env.NEXT_PUBLIC_DEMO_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_DEMO_ENABLED = originalDemoEnabled;
    }
  });

  it("keeps credential and demo mutation controls disabled in server markup until hydration", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(<LoginPage />);

    expect(markup).toMatch(/id="email"[^>]*disabled/);
    expect(markup).toMatch(/id="password"[^>]*disabled/);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Log In<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Try Our Demo<\/button>/);
    expect(markup).toContain("Preparing login…");
  });

  it("enables ordinary login after mount without waiting for session resolution", async () => {
    const { useSession } = jest.requireMock("next-auth/react") as { useSession: jest.Mock };
    useSession.mockReturnValue({ data: null, status: "loading" });

    render(<LoginPage />);

    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeEnabled());
    expect(screen.getByLabelText(/password/i)).toBeEnabled();
    expect(screen.getByRole("button", { name: /log in/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /try our demo/i })).toBeEnabled();
    expect(screen.queryByText("Preparing login…")).not.toBeInTheDocument();
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

  it("clicking demo button signs in with demo credentials", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "demo@isntgram.ai",
        password: "demo",
        redirect: false,
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows a generic error if demo sign-in fails", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "some error" });

    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));

    await waitFor(() => {
      expect(screen.getByText(/demo sign-in failed/i)).toBeInTheDocument();
    });
  });

  it("shows a generic error if demo sign-in throws", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockRejectedValueOnce(new Error("boom"));

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
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
    expect(emailInput).toHaveAttribute("aria-describedby", "login-email-error");
    expect(screen.getByText(/email is required/i)).toHaveAttribute("id", "login-email-error");
    expect(screen.getByText(/email is required/i)).toHaveAttribute("role", "alert");
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

  it("does not show an error on blur when the email is valid", async () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/email/i);

    fireEvent.change(emailInput, { target: { value: "valid@example.com" } });
    fireEvent.blur(emailInput);

    await waitFor(() => expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument());
  });

  it("clears field errors when the user edits the field", async () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText(/email/i);

    fireEvent.change(emailInput, { target: { value: "bad-email" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    fireEvent.change(emailInput, { target: { value: "valid@example.com" } });
    await waitFor(() => expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument());
  });

  it("validates password format on blur and clears on change", async () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(passwordInput, { target: { value: "weak" } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });

    fireEvent.change(passwordInput, { target: { value: "Password123" } });
    await waitFor(() => expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument());
  });

  it("submits valid form and calls Auth.js signIn", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "Password123",
        redirect: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/login successful/i)).toHaveAttribute("role", "status");
  });

  it("redirects after successful login", async () => {
    jest.useFakeTimers();
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockPush).toHaveBeenCalledWith("/");
    jest.useRealTimers();
  });

  it("cancels a completed login redirect when the login component unmounts", async () => {
    jest.useFakeTimers();
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    const { unmount } = render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });
    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/login successful/i)).toBeInTheDocument());
    unmount();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockPush).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("does not navigate after an unmounted demo sign-in resolves", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    let resolveSignIn!: (result: { ok: boolean; error: null }) => void;
    signIn.mockImplementation(
      () =>
        new Promise<{ ok: boolean; error: null }>((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    const { unmount } = render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));
    unmount();

    await act(async () => {
      resolveSignIn({ ok: true, error: null });
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a friendly error when signIn throws", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockRejectedValueOnce(new Error("Network down"));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/network down/i)).toBeInTheDocument());
  });

  it("shows a generic error when signIn throws a non-Error", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockRejectedValueOnce("boom");

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/login failed/i)).toBeInTheDocument());
  });

  it("renders success message from search params", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("message=Welcome%20back%21"));

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back!/i)).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    expect(screen.getByText(/logging in/i)).toBeInTheDocument();
  });

  it("handles authentication errors", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "Invalid credentials" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "WrongPass123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid credentials/i)).toHaveAttribute("role", "alert");
  });

  it("shows an unmapped sign-in error message", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "Account locked" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/account locked/i)).toBeInTheDocument();
    });
  });

  it("maps CredentialsSignin to a friendly error message", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: false, error: "CredentialsSignin" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "WrongPass123" } });

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
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

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

  it("uses demo credentials from environment when provided", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue({ ok: true, error: null });

    const originalEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;
    const originalPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
    process.env.NEXT_PUBLIC_DEMO_EMAIL = "demo@custom.test";
    process.env.NEXT_PUBLIC_DEMO_PASSWORD = "custompass";

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "demo@custom.test",
        password: "custompass",
        redirect: false,
      });
    });

    process.env.NEXT_PUBLIC_DEMO_EMAIL = originalEmail;
    process.env.NEXT_PUBLIC_DEMO_PASSWORD = originalPassword;
  });

  it("keeps the form available and shows recovery when signIn returns no result", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue(undefined);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText(/couldn't complete sign in/i)).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalledWith("/");
    expect(screen.getByRole("button", { name: /log in/i })).toBeEnabled();
  });

  it("keeps demo recovery available when signIn returns no result", async () => {
    const { signIn } = jest.requireMock("next-auth/react") as { signIn: jest.Mock };
    signIn.mockResolvedValue(undefined);

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /try our demo/i }));

    await waitFor(() => expect(screen.getByText(/couldn't complete sign in/i)).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalledWith("/");
    expect(screen.getByRole("button", { name: /try our demo/i })).toBeEnabled();
  });
});
