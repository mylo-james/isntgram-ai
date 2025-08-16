import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterPage from "./page";

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock API client
jest.mock("@/lib/api-client", () => ({
  apiClient: {
    register: jest.fn(),
  },
}));

describe("RegisterPage", () => {
  const mockRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup API client mock
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { register: jest.Mock } };
    apiClient.register = mockRegister;
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

  it("submits form with valid data and calls API", async () => {
    // Mock successful API response
    mockRegister.mockResolvedValue({
      user: {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
      },
      message: "User registered successfully",
    });

    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(fullNameInput, { target: { value: "Test User" } });
    fireEvent.change(usernameInput, { target: { value: "testuser" } });
    fireEvent.change(passwordInput, { target: { value: process.env.TEST_USER_PASSWORD || "TestPassword123!" } });

    const form = emailInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Verify API was called with correct data
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      });
    });

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
    });
  });

  it("shows loading state during form submission", async () => {
    // Mock slow API response
    mockRegister.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(fullNameInput, { target: { value: "Test User" } });
    fireEvent.change(usernameInput, { target: { value: "testuser" } });
    fireEvent.change(passwordInput, { target: { value: process.env.TEST_USER_PASSWORD || "TestPassword123!" } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/signing up/i)).toBeInTheDocument();
  });

  it("handles API errors and displays error messages", async () => {
    // Mock API error
    mockRegister.mockRejectedValue({
      response: {
        data: { message: "Email already exists" },
        status: 409,
      },
    });

    render(<RegisterPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const fullNameInput = screen.getByLabelText(/full name/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: "existing@example.com" } });
    fireEvent.change(fullNameInput, { target: { value: "Test User" } });
    fireEvent.change(usernameInput, { target: { value: "testuser" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    const form = emailInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it("handles username-specific backend error mapping", async () => {
    mockRegister.mockRejectedValue({
      response: { data: { message: "Username already taken" }, status: 409 },
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: process.env.TEST_USER_PASSWORD || "TestPassword123!" },
    });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/username already taken/i)).toBeInTheDocument();
    });
  });

  it("handles network/unknown errors gracefully", async () => {
    // Unknown error shape (non-Error instance)
    mockRegister.mockRejectedValue({ message: "Something weird" });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: process.env.TEST_USER_PASSWORD || "TestPassword123!" },
    });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/registration failed\. please try again\./i)).toBeInTheDocument();
    });
  });

  it("handles Error instance branch gracefully", async () => {
    // Reject with actual Error to hit error instanceof Error branch
    mockRegister.mockRejectedValue(new Error("Network down"));

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/network down/i)).toBeInTheDocument();
    });
  });
});
