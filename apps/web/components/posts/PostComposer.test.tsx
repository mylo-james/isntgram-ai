import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextEncoder } from "node:util";
import PostComposer from "./PostComposer";
import { ApiRequestError } from "@/lib/api-error";

Object.assign(globalThis, { TextEncoder });

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    createUploadUrl: jest.fn(),
    createPost: jest.fn(),
  },
}));

describe("PostComposer", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it("keeps every mutation control disabled in server markup until hydration", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(<PostComposer onPostCreated={jest.fn()} />);

    expect(markup).toMatch(/id="post-content"[^>]*disabled/);
    expect(markup).toMatch(/id="post-image"[^>]*disabled/);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Publish post<\/button>/);
    expect(markup).toContain("Preparing composer…");
  });

  it("associates submit errors with the draft and clears that association after a valid post", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createPost: jest.Mock };
    };
    apiClient.createPost.mockResolvedValueOnce({
      id: "post-1",
      content: "A valid draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "user-1", username: "me", fullName: "Me" },
    });
    render(<PostComposer onPostCreated={jest.fn()} />);

    const textarea = screen.getByLabelText("Post text (required)");
    expect(screen.getByLabelText("Photo (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Photo (optional)")).toHaveAttribute("type", "file");

    await waitFor(() => expect(screen.getByRole("button", { name: /^publish post$/i })).toBeEnabled());
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Write something before posting.");
    expect(alert).toHaveAttribute("id", "post-composer-error");
    expect(textarea).toHaveAttribute("aria-describedby", "post-content-help post-composer-error");

    fireEvent.change(textarea, { target: { value: "A valid draft" } });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toHaveAttribute("aria-describedby", "post-content-help");
  });

  it("shows an error when posting with empty content", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);

    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    expect(screen.getByText(/write something before posting/i)).toBeInTheDocument();
  });

  it("creates a post and resets the form", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createPost: jest.Mock };
    };

    apiClient.createPost.mockResolvedValue({
      id: "post-1",
      content: "Hello world",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "user-1", username: "me", fullName: "Me" },
    });

    render(<PostComposer onPostCreated={onPostCreated} />);

    const textarea = screen.getByLabelText("Post text (required)");
    fireEvent.change(textarea, { target: { value: "Hello world" } });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));
    expect(onPostCreated).toHaveBeenCalledTimes(1);
    expect(textarea).toHaveValue("");
  });

  it("uploads media when a file is selected", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };

    apiClient.createUploadUrl.mockResolvedValue({
      uploadUrl: "https://example.com/upload",
      uploadId: "upload-1",
      publicUrl: "https://cdn.example.com/file",
      key: "file",
      expiresIn: 60,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    apiClient.createPost.mockResolvedValue({
      id: "post-1",
      content: "Hello world",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "user-1", username: "me", fullName: "Me" },
    });

    render(<PostComposer onPostCreated={onPostCreated} />);

    const textarea = screen.getByLabelText("Post text (required)");
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    const fileInput = screen.getByLabelText("Photo (optional)");
    const file = new File(["hello"], "hello.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));

    expect(apiClient.createPost).toHaveBeenCalledWith(
      { content: "Hello world", mediaUploadId: "upload-1", mediaAltText: "A test photograph" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows an error when presigning upload fails", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };

    apiClient.createUploadUrl.mockRejectedValueOnce(new Error("S3 down"));

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["nope"], "fail.png", { type: "image/png" })] },
    });

    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/wasn’t published/i)).toBeInTheDocument());
    expect(apiClient.createPost).not.toHaveBeenCalled();
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("retains a selected photo and draft when presign omits the upload identity", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    const photo = new File(["missing-id"], "identity.png", { type: "image/png" });
    apiClient.createUploadUrl.mockResolvedValueOnce({ uploadUrl: "https://example.com/upload" });

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), {
      target: { value: "Keep this draft" },
    });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), { target: { files: [photo] } });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    expect(await screen.findByText(/wasn’t published/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toHaveValue("Keep this draft");
    expect(screen.getByText("identity.png")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(apiClient.createPost).not.toHaveBeenCalled();
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("shows an error when upload fails", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };

    apiClient.createUploadUrl.mockResolvedValue({
      uploadUrl: "https://example.com/upload",
      uploadId: "upload-1",
      publicUrl: "https://cdn.example.com/file",
      key: "file",
      expiresIn: 60,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["nope"], "fail.png", { type: "image/png" })] },
    });

    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/wasn’t published/i)).toBeInTheDocument());
    expect(apiClient.createPost).not.toHaveBeenCalled();
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads before presigning", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Hello" } });

    const fileInput = screen.getByLabelText("Photo (optional)") as HTMLInputElement;
    const bigBuffer = new Uint8Array(5 * 1024 * 1024 + 1);
    const bigFile = new File([bigBuffer], "big.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(screen.getByText(/photo is too large/i)).toBeInTheDocument());
    expect(apiClient.createUploadUrl).not.toHaveBeenCalled();
    expect(fileInput.value).toBe("");
  });

  it("uses a fallback error message when posting fails with a non-Error", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createPost: jest.Mock };
    };

    apiClient.createPost.mockRejectedValueOnce("boom");

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Hello" } });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(screen.getByText(/wasn’t published/i)).toBeInTheDocument());
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("surfaces createPost errors when they are Error instances", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createPost: jest.Mock };
    };

    apiClient.createPost.mockRejectedValueOnce(new Error("API down"));

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Hello" } });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    await waitFor(() => expect(screen.getByText(/wasn’t published/i)).toBeInTheDocument());
    expect(onPostCreated).not.toHaveBeenCalled();
  });
  it("keeps the original upload ID and draft for a deliberate retry after publication timeout", async () => {
    jest.useFakeTimers();
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "upload-timeout",
      uploadUrl: "https://example.com/upload",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    apiClient.createPost
      .mockImplementationOnce(
        (_data: unknown, options: { signal: AbortSignal }) =>
          new Promise((_, reject) => {
            options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      )
      .mockResolvedValueOnce({
        id: "resolved-post",
        content: "Keep me",
        author: { id: "u", username: "u", fullName: "U" },
      });

    render(<PostComposer onPostCreated={onPostCreated} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Keep me" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "keep.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(await screen.findByText(/could not confirm publication/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toHaveValue("Keep me");
    expect(screen.getByText("keep.png")).toBeInTheDocument();
    expect(onPostCreated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /retry original photo post/i }));
    await waitFor(() =>
      expect(apiClient.createPost).toHaveBeenLastCalledWith(
        { content: "Keep me", mediaUploadId: "upload-timeout", mediaAltText: "A test photograph" },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(onPostCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "resolved-post" }));
    jest.useRealTimers();
  });

  it("preserves and locks a media attempt after a network failure without another presign", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "network-upload",
      uploadUrl: "https://example.com/upload",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    apiClient.createPost.mockRejectedValueOnce(new TypeError("network lost"));
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Network draft" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "network.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    expect(await screen.findByRole("button", { name: /retry original photo post/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toBeDisabled();
    expect(screen.getByLabelText("Photo (optional)")).toBeDisabled();
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("retries the original upload identity and keeps it locked after another uncertain result", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "retry-original-id",
      uploadUrl: "https://example.com/upload",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    apiClient.createPost
      .mockRejectedValueOnce(new TypeError("first connection lost"))
      .mockRejectedValueOnce(new TypeError("second connection lost"));

    render(<PostComposer onPostCreated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Post text (required)"), {
      target: { value: "Retry the same attempt" },
    });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "retry.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));

    const retry = await screen.findByRole("button", { name: /retry original photo post/i });
    fireEvent.click(retry);

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(2));
    expect(apiClient.createPost).toHaveBeenNthCalledWith(
      2,
      { content: "Retry the same attempt", mediaUploadId: "retry-original-id", mediaAltText: "A test photograph" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /retry original photo post/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toBeDisabled();
    expect(screen.getByLabelText("Photo (optional)")).toBeDisabled();
  });

  it("allows correction after a definitive typed media rejection", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "rejected-upload",
      uploadUrl: "https://example.com/upload",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    apiClient.createPost.mockRejectedValueOnce(
      new ApiRequestError("Your post wasn’t published. Your draft and selected photo are still here. Try again.", 400),
    );
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Correct me" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "expired.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    expect(
      await screen.findByText("Your post wasn’t published. Your draft and selected photo are still here. Try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry original photo post/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toBeEnabled();
    expect(screen.getByLabelText("Photo (optional)")).toBeEnabled();
  });

  it("locks all mutation controls after a typed 503 media publication failure", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "service-upload",
      uploadUrl: "https://example.com/upload",
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    apiClient.createPost.mockRejectedValueOnce(new ApiRequestError("Service unavailable", 503));
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Service draft" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "service.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await screen.findByRole("button", { name: /retry original photo post/i });
    expect(screen.getByLabelText("Post text (required)")).toBeDisabled();
    expect(screen.getByLabelText("Photo (optional)")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^publish post$/i })).toBeDisabled();
  });

  it("keeps draft and photo after the 15-second direct PUT deadline without publishing", async () => {
    jest.useFakeTimers();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({ uploadId: "put-timeout", uploadUrl: "https://example.com/upload" });
    (global.fetch as jest.Mock).mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "PUT draft" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "put.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(await screen.findByText(/wasn’t published/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toHaveValue("PUT draft");
    expect(screen.getByText("put.png")).toBeInTheDocument();
    expect(apiClient.createPost).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("aborts publication on unmount and ignores a late completion", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { createPost: jest.Mock } };
    let resolvePost: (value: unknown) => void = () => {};
    let signal: AbortSignal | undefined;
    apiClient.createPost.mockImplementationOnce((_data: unknown, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise((resolve) => {
        resolvePost = resolve;
      });
    });
    const view = render(<PostComposer onPostCreated={onPostCreated} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Unmounted" } });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalled());
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolvePost({ id: "late", content: "Unmounted", author: { id: "u", username: "u", fullName: "U" } });
    });
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("releases an uncertain attempt after its explicit retry receives a typed 400", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({ uploadId: "original-id", uploadUrl: "https://example.com/upload" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    apiClient.createPost
      .mockRejectedValueOnce(new TypeError("lost"))
      .mockRejectedValueOnce(
        new ApiRequestError(
          "Your post wasn’t published. Your draft and selected photo are still here. Try again.",
          400,
        ),
      );
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Original draft" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "original.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await screen.findByRole("button", { name: /retry original photo post/i });
    fireEvent.click(screen.getByRole("button", { name: /retry original photo post/i }));
    expect(
      await screen.findByText("Your post wasn’t published. Your draft and selected photo are still here. Try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry original photo post/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toBeEnabled();
    expect(screen.getByLabelText("Photo (optional)")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Corrected draft" } });
    expect(screen.getByLabelText("Post text (required)")).toHaveValue("Corrected draft");
  });

  it("does not publish after unmount while presigning", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    let resolvePresign: (value: unknown) => void = () => {};
    apiClient.createUploadUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePresign = resolve;
        }),
    );
    const view = render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Presign" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "presign.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalled());
    view.unmount();
    await act(async () => {
      resolvePresign({ uploadId: "late", uploadUrl: "https://example.com/upload" });
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(apiClient.createPost).not.toHaveBeenCalled();
  });

  it("does not publish after unmount while direct PUT is pending", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({ uploadId: "put-late", uploadUrl: "https://example.com/upload" });
    let resolvePut: (value: unknown) => void = () => {};
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePut = resolve;
        }),
    );
    const view = render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "PUT late" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "late.png", { type: "image/png" })] },
    });
    if (
      screen.queryByLabelText("Photo description (required with a photo)") &&
      !(screen.getByLabelText("Photo description (required with a photo)") as HTMLTextAreaElement).disabled
    )
      fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
        target: { value: "A test photograph" },
      });
    fireEvent.click(screen.getByRole("button", { name: /^publish post$/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    view.unmount();
    await act(async () => {
      resolvePut({ ok: true });
    });
    expect(apiClient.createPost).not.toHaveBeenCalled();
  });
  it("requires an associated description, previews the selected photo, and removes it without losing text", async () => {
    const createObjectURL = jest.fn(() => "blob:preview");
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const view = render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Keep caption" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    const description = screen.getByLabelText("Photo description (required with a photo)");
    expect(description).toHaveFocus();
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAttribute("aria-describedby", "post-description-help post-composer-error");
    fireEvent.change(description, { target: { value: "A boat" } });
    expect(screen.getByAltText("A boat")).toHaveAttribute("src", "blob:preview");
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByLabelText("Photo description (required with a photo)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post text (required)")).toHaveValue("Keep caption");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    view.unmount();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("keeps a draft on Cancel until discard is explicitly chosen", async () => {
    const onCancel = jest.fn();
    render(<PostComposer onPostCreated={jest.fn()} onCancel={onCancel} />);
    const draft = screen.getByLabelText("Post text (required)");
    fireEvent.change(draft, { target: { value: "Not yet shared" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(draft).toHaveValue("Not yet shared");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(draft).toHaveValue("Not yet shared");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(draft).toHaveValue("");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("can dismiss an unconfirmed-publication message without releasing the original payload", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({ uploadUrl: "https://example.test/upload", uploadId: "retained" });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    apiClient.createPost.mockRejectedValue(new TypeError("Lost response"));
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "Original caption" } });
    fireEvent.change(screen.getByLabelText("Photo (optional)"), {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    fireEvent.change(screen.getByLabelText("Photo description (required with a photo)"), {
      target: { value: "Original description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await screen.findByRole("button", { name: "Retry original photo post" });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Photo description (required with a photo)")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry original photo post" }));
    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(2));
    expect(apiClient.createPost.mock.calls[0][0]).toEqual(apiClient.createPost.mock.calls[1][0]);
    expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1);
  });
});
