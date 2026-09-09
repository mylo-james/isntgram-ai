import { render, screen, fireEvent } from "@testing-library/react";
import Input from "./Input";

describe("Input", () => {
  it("renders input with label", () => {
    render(<Input label="Test Label" id="test" />);

    expect(screen.getByLabelText(/test label/i)).toBeInTheDocument();
  });

  it("associates an explicit error with the input while retaining a caller description", () => {
    const { rerender } = render(
      <Input label="Test Label" id="test" error="This is an error" aria-describedby="test-help" />,
    );

    const input = screen.getByLabelText("Test Label");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This is an error");
    expect(alert).toHaveAttribute("id", "test-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "test-help test-error");
    expect(input).toHaveClass("border-red-500", "focus:ring-red-500", "focus:border-red-500");

    rerender(<Input label="Test Label" id="test" aria-describedby="test-help" />);
    expect(screen.getByLabelText("Test Label")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Test Label")).toHaveAttribute("aria-describedby", "test-help");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("associates a validation error and keeps the normal state visually distinct", () => {
    const validation = { isValid: false, message: "Validation failed" };
    const { rerender } = render(<Input label="Test Label" id="test" validation={validation} />);

    const invalidInput = screen.getByLabelText("Test Label");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "test-error");
    expect(invalidInput).toHaveAttribute("aria-invalid", "true");
    expect(invalidInput).toHaveAttribute("aria-describedby", "test-error");
    expect(invalidInput).toHaveClass("border-red-500", "focus:ring-red-500", "focus:border-red-500");

    rerender(<Input label="Test Label" id="test" validation={{ isValid: true, message: "Valid" }} />);
    const validInput = screen.getByLabelText("Test Label");
    expect(validInput).not.toHaveAttribute("aria-invalid");
    expect(validInput).not.toHaveAttribute("aria-describedby");
    expect(validInput).toHaveClass("border-gray-300", "focus:ring-blue-500", "focus:border-blue-500");
    expect(validInput).not.toHaveClass("border-red-500", "focus:ring-red-500", "focus:border-red-500");
  });

  it("prioritizes error over validation message", () => {
    const validation = { isValid: false, message: "Validation failed" };
    render(<Input label="Test Label" id="test" error="Custom error" validation={validation} />);

    expect(screen.getByText("Custom error")).toBeInTheDocument();
    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
  });

  it("handles onBlur event", () => {
    const handleBlur = jest.fn();
    render(<Input label="Test Label" id="test" onBlur={handleBlur} />);

    const input = screen.getByDisplayValue("");
    fireEvent.blur(input);

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it("handles onBlur event without handler", () => {
    render(<Input label="Test Label" id="test" />);

    const input = screen.getByDisplayValue("");
    // Should not throw error when no onBlur handler is provided
    expect(() => fireEvent.blur(input)).not.toThrow();
  });

  it("applies custom className", () => {
    render(<Input label="Test Label" id="test" className="custom-class" />);

    const input = screen.getByDisplayValue("");
    expect(input).toHaveClass("custom-class");
  });

  it("passes through all input props", () => {
    render(<Input label="Test Label" id="test" placeholder="Enter text" type="email" required disabled />);

    const input = screen.getByDisplayValue("");
    expect(input).toHaveAttribute("placeholder", "Enter text");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("required");
    expect(input).toBeDisabled();
  });

  it("does not show error message when no error and validation is valid", () => {
    const validation = { isValid: true, message: "Valid" };
    render(<Input label="Test Label" id="test" validation={validation} />);

    expect(screen.queryByText("Valid")).not.toBeInTheDocument();
  });
});
