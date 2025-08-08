import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("LoginPage", () => {
  it("renders login form with required fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
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

  it("submits valid form and shows success", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(
      () => {
        expect(screen.getByText(/login successful/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows loading state during submission", () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });

    const form = screen.getByLabelText(/email/i).closest("form");
    if (form) fireEvent.submit(form);

    expect(screen.getByText(/logging in/i)).toBeInTheDocument();
  });
});
