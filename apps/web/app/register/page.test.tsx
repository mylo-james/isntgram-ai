import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterPage from "./page";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders registration form with all required fields", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("displays validation errors for empty required fields", async () => {
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const form = emailInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Wait a bit longer for validation to complete
    await waitFor(
      () => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it("validates email format", async () => {
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it("validates password complexity", async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "weak" } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("submits form with valid data", async () => {
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    // const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(fullNameInput, { target: { value: "Test User" } });
    fireEvent.change(usernameInput, { target: { value: "testuser" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const form = emailInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for loading state to complete
    await waitFor(
      () => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows loading state during form submission", async () => {
    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(fullNameInput, { target: { value: "Test User" } });
    fireEvent.change(usernameInput, { target: { value: "testuser" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/signing up/i)).toBeInTheDocument();
  });
});
