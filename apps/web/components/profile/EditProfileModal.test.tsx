import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditProfileModal, { type EditProfileInitialValues } from "./EditProfileModal";
import { apiClient } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/api-error";

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
    expect(screen.getByLabelText(/username/i)).toHaveAttribute(
      "aria-describedby",
      "edit-username-help edit-profile-username-error",
    );
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

  it("uploads a selected photo once and retries the same upload identity after a save failure", async () => {
    const createUploadUrl = jest.spyOn(apiClient, "createUploadUrl").mockResolvedValue({
      uploadId: "upload-1",
      uploadUrl: "https://example.test/upload",
      publicUrl: "https://cdn.example.test/pending/upload-1",
      key: "pending/1/upload-1",
      expiresIn: 900,
    });
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const onSubmit = jest.fn().mockRejectedValueOnce(new Error("save failed")).mockResolvedValueOnce(undefined);
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("profile-photo-input"), {
      target: { files: [new File(["photo"], "portrait.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ ...initialValues, profilePictureUploadId: "upload-1" }),
    );
    await waitFor(() => expect(screen.getByText(/couldn't save your profile/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /try saving again/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(createUploadUrl).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous valid photo when a replacement is unsupported or too large", async () => {
    const createUploadUrl = jest.spyOn(apiClient, "createUploadUrl").mockResolvedValue({
      uploadId: "upload-1",
      uploadUrl: "https://example.test/upload",
      publicUrl: "https://cdn.example.test/pending/upload-1",
      key: "pending/1/upload-1",
      expiresIn: 900,
    });
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const onSubmit = jest.fn();
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} onSubmit={onSubmit} />);

    const input = screen.getByTestId("profile-photo-input");
    fireEvent.change(input, { target: { files: [new File(["photo"], "valid.png", { type: "image/png" })] } });
    fireEvent.change(input, { target: { files: [new File(["text"], "invalid.txt", { type: "text/plain" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/choose a jpeg, png, webp, or gif/i);
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/up to 5mb/i);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(createUploadUrl).toHaveBeenCalledWith({
        fileName: "valid.png",
        contentType: "image/png",
        contentLength: 5,
      }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ ...initialValues, profilePictureUploadId: "upload-1" }),
    );
  });

  it("clears a timed-out direct upload intent while retaining the chosen photo for a fresh retry", async () => {
    jest.useFakeTimers();
    try {
      const createUploadUrl = jest
        .spyOn(apiClient, "createUploadUrl")
        .mockResolvedValueOnce({
          uploadId: "expired-upload",
          uploadUrl: "https://example.test/expired-upload",
          publicUrl: "https://cdn.example.test/pending/expired-upload",
          key: "pending/1/expired-upload",
          expiresIn: 900,
        })
        .mockResolvedValueOnce({
          uploadId: "fresh-upload",
          uploadUrl: "https://example.test/fresh-upload",
          publicUrl: "https://cdn.example.test/pending/fresh-upload",
          key: "pending/1/fresh-upload",
          expiresIn: 900,
        });
      createUploadUrl.mockClear();
      global.fetch = jest
        .fn()
        .mockImplementationOnce(
          (_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
                once: true,
              });
            }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const onSubmit = jest.fn();
      render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} onSubmit={onSubmit} />);
      fireEvent.change(screen.getByTestId("profile-photo-input"), {
        target: { files: [new File(["photo"], "portrait.png", { type: "image/png" })] },
      });
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/photo upload timed out/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /try saving again/i }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(createUploadUrl).toHaveBeenCalledTimes(2);
      expect(onSubmit).toHaveBeenCalledWith({ ...initialValues, profilePictureUploadId: "fresh-upload" });
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not start a direct upload when a presign resolves after unmount", async () => {
    let resolvePresign: (value: Awaited<ReturnType<typeof apiClient.createUploadUrl>>) => void = () => {};
    jest.spyOn(apiClient, "createUploadUrl").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePresign = resolve;
        }),
    );
    global.fetch = jest.fn();
    const view = render(
      <EditProfileModal open onClose={jest.fn()} initialValues={initialValues} onSubmit={jest.fn()} />,
    );
    const initialPresignCalls = (apiClient.createUploadUrl as jest.Mock).mock.calls.length;

    fireEvent.change(screen.getByTestId("profile-photo-input"), {
      target: { files: [new File(["photo"], "portrait.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect((apiClient.createUploadUrl as jest.Mock).mock.calls.length).toBeGreaterThan(initialPresignCalls),
    );
    view.unmount();
    await act(async () => {
      resolvePresign({
        uploadId: "late-upload",
        uploadUrl: "https://example.test/late-upload",
        publicUrl: "https://cdn.example.test/pending/late-upload",
        key: "pending/1/late-upload",
        expiresIn: 900,
      });
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses a fresh upload intent after a definitive photo rejection but retains one for an uncertain save", async () => {
    const createUploadUrl = jest
      .spyOn(apiClient, "createUploadUrl")
      .mockResolvedValueOnce({
        uploadId: "rejected-upload",
        uploadUrl: "https://example.test/rejected-upload",
        publicUrl: "https://cdn.example.test/pending/rejected-upload",
        key: "pending/1/rejected-upload",
        expiresIn: 900,
      })
      .mockResolvedValueOnce({
        uploadId: "fresh-upload",
        uploadUrl: "https://example.test/fresh-upload",
        publicUrl: "https://cdn.example.test/pending/fresh-upload",
        key: "pending/1/fresh-upload",
        expiresIn: 900,
      });
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new ApiRequestError("unsupported", 415))
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(undefined);
    render(<EditProfileModal open onClose={jest.fn()} initialValues={initialValues} onSubmit={onSubmit} />);
    const initialPresignCalls = createUploadUrl.mock.calls.length;

    fireEvent.change(screen.getByTestId("profile-photo-input"), {
      target: { files: [new File(["photo"], "portrait.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Choose another photo"));

    fireEvent.click(screen.getByRole("button", { name: /try saving again/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith({ ...initialValues, profilePictureUploadId: "fresh-upload" }),
    );
    expect(createUploadUrl.mock.calls.length).toBe(initialPresignCalls + 2);

    fireEvent.click(screen.getByRole("button", { name: /try saving again/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));
    expect(createUploadUrl.mock.calls.length).toBe(initialPresignCalls + 2);
  });
});
