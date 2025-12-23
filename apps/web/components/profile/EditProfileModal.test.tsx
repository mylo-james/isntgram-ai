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

  it("does not show the username change hint when username is unchanged", () => {
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} />);

    expect(screen.queryByText(/changing your username will update your profile url/i)).not.toBeInTheDocument();
  });

  it("calls onClose when clicking cancel and when pressing escape", () => {
    const onClose = jest.fn();
    render(<EditProfileModal open onClose={onClose} initialValues={initialValues} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on overlay click but not when clicking inside the dialog", () => {
    const onClose = jest.fn();
    render(<EditProfileModal open onClose={onClose} initialValues={initialValues} />);

    fireEvent.mouseDown(screen.getByText("Edit Profile"));
    expect(onClose).toHaveBeenCalledTimes(0);

    fireEvent.mouseDown(screen.getByTestId("edit-profile-modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit with updated values", async () => {
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "New Name" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });

    expect(screen.getByText(/changing your username will update your profile url/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ fullName: "New Name", username: "newuser" });
    });
  });

  it("validates full name and username before submitting", async () => {
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} />);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(0);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Valid Name" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "bad user" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/username can only contain (lowercase )?letters, numbers, and underscores/i),
      ).toBeInTheDocument();
    });
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it("checks username availability when provided", async () => {
    const onSubmit = jest.fn();
    const checkUsername = jest.fn().mockResolvedValue(false);
    render(
      <EditProfileModal
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        checkUsername={checkUsername}
        initialValues={initialValues}
      />,
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "New Name" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(checkUsername).toHaveBeenCalledWith("newuser"));
    await waitFor(() => expect(screen.getByText(/username already taken/i)).toBeInTheDocument());
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it("submits when username availability check succeeds", async () => {
    const onSubmit = jest.fn();
    const checkUsername = jest.fn().mockResolvedValue(true);
    render(
      <EditProfileModal
        open
        onClose={jest.fn()}
        onSubmit={onSubmit}
        checkUsername={checkUsername}
        initialValues={initialValues}
      />,
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "New Name" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "newuser" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(checkUsername).toHaveBeenCalledWith("newuser"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ fullName: "New Name", username: "newuser" }));
  });
});
