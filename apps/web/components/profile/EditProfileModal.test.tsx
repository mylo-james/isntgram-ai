import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditProfileModal, { type EditProfileInitialValues } from "./EditProfileModal";

describe("EditProfileModal", () => {
  const initialValues: EditProfileInitialValues = { fullName: "Test User", username: "testuser" };

  it("does not render when open is false", () => {
    const { container } = render(<EditProfileModal open={false} onClose={jest.fn()} initialValues={initialValues} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders when open and shows initial values", () => {
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} />);

    const modal = screen.getByTestId("edit-profile-modal");
    expect(modal).toBeInTheDocument();

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Test User");
    expect(screen.getByLabelText(/username/i)).toHaveValue("testuser");
  });

  it("calls onClose when clicking cancel and when pressing escape", () => {
    const onClose = jest.fn();
    render(<EditProfileModal open onClose={onClose} initialValues={initialValues} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("calls onSubmit with updated values", async () => {
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "New Name" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ fullName: "New Name", username: "newuser" });
    });
  });
});
