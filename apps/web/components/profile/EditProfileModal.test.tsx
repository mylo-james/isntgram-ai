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
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveFocus());
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute("aria-describedby", "edit-profile-full-name-error");
    expect(screen.getByText(/full name is required/i)).toHaveAttribute("role", "alert");
    expect(onSubmit).toHaveBeenCalledTimes(0);

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Valid Name" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "bad user" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/username can only contain (lowercase )?letters, numbers, and underscores/i),
      ).toBeInTheDocument();
    });
    await waitFor(() => expect(screen.getByLabelText(/username/i)).toHaveFocus());
    expect(screen.getByLabelText(/username/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/username/i)).toHaveAttribute("aria-describedby", "edit-profile-username-error");
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

  it("preserves edits and focuses username when availability cannot be checked", async () => {
    const checkUsername = jest.fn().mockRejectedValue(new Error("offline"));
    render(
      <EditProfileModal
        open
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        checkUsername={checkUsername}
        initialValues={initialValues}
      />,
    );

    const username = screen.getByLabelText(/username/i);
    fireEvent.change(username, { target: { value: "newuser" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(screen.getByText(/couldn't save your profile/i)).toBeInTheDocument());
    expect(username).toHaveValue("newuser");
    expect(username).toHaveFocus();
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });

  it("preserves edits and restores focus after a rejected profile save", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("save failed"));
    render(<EditProfileModal open onClose={jest.fn()} onSubmit={onSubmit} initialValues={initialValues} />);

    const fullName = screen.getByLabelText(/full name/i);
    const username = screen.getByLabelText(/username/i);
    fireEvent.change(fullName, { target: { value: "New Name" } });
    fireEvent.change(username, { target: { value: "newuser" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(screen.getByText(/couldn't save your profile/i)).toBeInTheDocument());
    expect(fullName).toHaveValue("New Name");
    expect(username).toHaveValue("newuser");
    expect(username).toHaveFocus();
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });
});
