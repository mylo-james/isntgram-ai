import { render, screen, fireEvent } from "@testing-library/react";
import Form from "./Form";

describe("Form", () => {
  it("renders children and submits", () => {
    const handleSubmit = jest.fn((e) => e.preventDefault());
    render(
      <Form onSubmit={handleSubmit}>
        <button type="submit">Submit</button>
      </Form>,
    );

    fireEvent.click(screen.getByText(/submit/i));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it("displays error message when provided", () => {
    render(
      <Form onSubmit={(e) => e.preventDefault()} errorMessage="Something went wrong">
        <button type="submit">Submit</button>
      </Form>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
