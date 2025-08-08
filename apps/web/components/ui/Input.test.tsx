import { render, screen } from "@testing-library/react";
import Input from "./Input";

describe("Input", () => {
  it("renders input with label", () => {
    render(<Input label="Test Label" id="test" />);

    expect(screen.getByLabelText(/test label/i)).toBeInTheDocument();
  });
});
