import { render, screen, fireEvent } from "@testing-library/react";
import Input from "./Input";

describe("Input", () => {
  it("renders input with label", () => {
    render(<Input label="Test Label" id="test" />);

    expect(screen.getByLabelText(/test label/i)).toBeInTheDocument();
  });

  it("renders input with error message", () => {
    render(<Input label="Test Label" id="test" error="This is an error" />);

    expect(screen.getByText("This is an error")).toBeInTheDocument();
    expect(screen.getByDisplayValue("")).toHaveClass("border-red-300");
  });

  it("renders input with validation error", () => {
    const validation = { isValid: false, message: "Validation failed" };
    render(<Input label="Test Label" id="test" validation={validation} />);

    expect(screen.getByText("Validation failed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("")).toHaveClass("border-red-300");
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

  it("applies error styling when has error", () => {
    render(<Input label="Test Label" id="test" error="Error message" />);

    const input = screen.getByDisplayValue("");
    expect(input).toHaveClass("border-red-300", "focus:ring-red-500", "focus:border-red-500");
  });

  it("applies error styling when validation fails", () => {
    const validation = { isValid: false, message: "Invalid" };
    render(<Input label="Test Label" id="test" validation={validation} />);

    const input = screen.getByDisplayValue("");
    expect(input).toHaveClass("border-red-300", "focus:ring-red-500", "focus:border-red-500");
  });

  it("applies normal styling when no error", () => {
    render(<Input label="Test Label" id="test" />);

    const input = screen.getByDisplayValue("");
    expect(input).toHaveClass("border-gray-300", "focus:ring-blue-500", "focus:border-blue-500");
    expect(input).not.toHaveClass("border-red-300", "focus:ring-red-500", "focus:border-red-500");
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
