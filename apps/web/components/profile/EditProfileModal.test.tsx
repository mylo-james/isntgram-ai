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

  it("shows demo mode message and disables inputs when isDemoUser is true", () => {
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} isDemoUser />);

    expect(screen.getByText(/demo mode: profile editing is disabled/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeDisabled();
    expect(screen.getByLabelText(/username/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("shows validation errors for empty fields", async () => {
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "ab" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows username validation error for short usernames", async () => {
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("checks username availability when checkUsername is provided", async () => {
    const onSubmit = jest.fn();
    const checkUsername = jest.fn().mockResolvedValue(false); // username taken
    render(
      <EditProfileModal
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        checkUsername={checkUsername}
        initialValues={initialValues}
      />
    );

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "takenuser" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(checkUsername).toHaveBeenCalledWith("takenuser");
      expect(screen.getByText(/username already taken/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("proceeds with submission when username is available", async () => {
    const onSubmit = jest.fn();
    const checkUsername = jest.fn().mockResolvedValue(true); // username available
    render(
      <EditProfileModal
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        checkUsername={checkUsername}
        initialValues={initialValues}
      />
    );

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(checkUsername).toHaveBeenCalledWith("newuser");
      expect(onSubmit).toHaveBeenCalledWith({ fullName: "Test User", username: "newuser" });
    });
  });

  it("shows hint when username changes", () => {
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newusername" } });

    expect(screen.getByText(/changing your username will update your profile url/i)).toBeInTheDocument();
  });

  it("closes modal when clicking overlay", () => {
    const onClose = jest.fn();
    render(<EditProfileModal open onClose={onClose} initialValues={initialValues} />);

    const modal = screen.getByTestId("edit-profile-modal");
    fireEvent.mouseDown(modal);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close modal when clicking inside", () => {
    const onClose = jest.fn();
    render(<EditProfileModal open onClose={onClose} initialValues={initialValues} />);

    const innerDiv = screen.getByText("Edit Profile").closest("div");
    fireEvent.mouseDown(innerDiv!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not submit when isDemoUser is true", async () => {
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} isDemoUser />);

    // The save button should be disabled, so we just verify onSubmit is never called
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
