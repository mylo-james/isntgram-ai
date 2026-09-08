import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TextEncoder } from "node:util";
import PostComposer from "./PostComposer";
import { ApiRequestError } from "@/lib/api-error";

Object.assign(globalThis, { TextEncoder });

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    createUploadUrl: jest.fn(),
    createPost: jest.fn(),
    getAiCapabilities: jest.fn(),
    rewritePost: jest.fn(),
  },
}));

describe("PostComposer", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { getAiCapabilities: jest.Mock };
    };
    apiClient.getAiCapabilities.mockResolvedValue({
      mode: "mock",
      available: true,
      label: "Demo text formatter",
    });
  });

  it("keeps every mutation control disabled in server markup until hydration", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(<PostComposer onPostCreated={jest.fn()} />);

    expect(markup).toMatch(/id="post-content"[^>]*disabled/);
    expect(markup).toMatch(/id="post-image"[^>]*disabled/);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>AI polish<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Post<\/button>/);
    expect(markup).toContain("Preparing composer…");
  });

  it("enables ordinary posting after mount without waiting for AI capabilities", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { getAiCapabilities: jest.Mock };
    };
    apiClient.getAiCapabilities.mockReturnValue(new Promise(() => {}));

    render(<PostComposer onPostCreated={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText("Post content")).toBeEnabled());
    expect(screen.getByLabelText("Upload image")).toBeEnabled();
    expect(screen.getByRole("button", { name: /^post$/i })).toBeEnabled();
    expect(screen.queryByRole("status", { name: /preparing composer/i })).not.toBeInTheDocument();
  });

  it("shows an error when AI polish is used with empty content", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /ai polish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));

    expect(screen.getByText(/write something before rewriting/i)).toBeInTheDocument();
  });

  it("rewrites content via apiClient and updates the textarea", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { rewritePost: jest.Mock };
    };

    apiClient.rewritePost.mockResolvedValue({
      content: "Rewritten content.",
      provider: "mock",
    });

    render(<PostComposer onPostCreated={jest.fn()} />);

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "hello world" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /ai polish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));

    await waitFor(() => expect(apiClient.rewritePost).toHaveBeenCalledTimes(1));
    expect(textarea).toHaveValue("hello world");
    expect(screen.getByText("Suggested draft")).toBeInTheDocument();
    expect(screen.getByText("Rewritten content.")).toBeInTheDocument();
    expect(screen.getByText("Demo text formatter")).toBeInTheDocument();
  });

  it("accepts, rejects, and undoes an AI suggestion without publishing it", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { rewritePost: jest.Mock; createPost: jest.Mock };
    };
    apiClient.rewritePost.mockResolvedValue({ content: "Suggested text", provider: "mock" });

    render(<PostComposer onPostCreated={jest.fn()} />);

    const textarea = screen.getByLabelText("Post content");
    fireEvent.change(textarea, { target: { value: "Original text" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /ai polish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument());
    expect(apiClient.createPost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(textarea).toHaveValue("Original text");
    expect(screen.queryByText("Suggested text")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(textarea).toHaveValue("Suggested text");

    fireEvent.click(screen.getByRole("button", { name: /undo accepted suggestion/i }));
    expect(textarea).toHaveValue("Original text");
    expect(screen.getByText("Suggested text")).toBeInTheDocument();
  });

  it("disables rewriting after a capability failure while normal posting remains available", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { getAiCapabilities: jest.Mock; createPost: jest.Mock };
    };
    apiClient.getAiCapabilities.mockRejectedValueOnce(new Error("Capabilities unavailable"));
    apiClient.createPost.mockResolvedValue({
      id: "post-1",
      content: "Still posting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: "user-1", username: "me", fullName: "Me" },
    });

    render(<PostComposer onPostCreated={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/ai rewriting is unavailable/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /ai polish/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Post content"), {
      target: { value: "Still posting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));
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

    const textarea = screen.getByLabelText("Post content");
    expect(screen.getByLabelText("Upload image")).toBeInTheDocument();
    expect(screen.getByText("Choose photo")).toHaveClass("peer-focus-visible:ring-2");

    await waitFor(() => expect(screen.getByRole("button", { name: /^post$/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Write something before posting.");
    expect(alert).toHaveAttribute("id", "post-composer-error");
    expect(textarea).toHaveAttribute("aria-describedby", "post-composer-error");

    fireEvent.change(textarea, { target: { value: "A valid draft" } });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).not.toHaveAttribute("aria-describedby");
  });

  it("shows a friendly error when AI rewrite fails", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { rewritePost: jest.Mock };
    };
    apiClient.rewritePost.mockRejectedValueOnce(new Error("Provider down"));

    render(<PostComposer onPostCreated={jest.fn()} />);

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "hello world" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /ai polish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));

    await waitFor(() => expect(screen.getByText(/provider down/i)).toBeInTheDocument());
  });

  it("falls back to a generic message when AI rewrite fails with a non-Error", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { rewritePost: jest.Mock };
    };
    apiClient.rewritePost.mockRejectedValueOnce("boom");

    render(<PostComposer onPostCreated={jest.fn()} />);

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "hello world" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /ai polish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));

    await waitFor(() => expect(screen.getByText(/ai rewrite failed/i)).toBeInTheDocument());
  });

  it("shows an error when posting with empty content", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

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

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

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

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    const fileInput = screen.getByLabelText("Upload image");
    const file = new File(["hello"], "hello.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));

    expect(apiClient.createPost).toHaveBeenCalledWith(
      { content: "Hello world", mediaUploadId: "upload-1" },
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

    fireEvent.change(screen.getByPlaceholderText(/share your latest idea/i), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["nope"], "fail.png", { type: "image/png" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/s3 down/i)).toBeInTheDocument());
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

    fireEvent.change(screen.getByLabelText("Post content"), {
      target: { value: "Keep this draft" },
    });
    fireEvent.change(screen.getByLabelText("Upload image"), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    expect(await screen.findByText(/missing upload id/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toHaveValue("Keep this draft");
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

    fireEvent.change(screen.getByPlaceholderText(/share your latest idea/i), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["nope"], "fail.png", { type: "image/png" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/upload failed/i)).toBeInTheDocument());
    expect(apiClient.createPost).not.toHaveBeenCalled();
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads before presigning", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByPlaceholderText(/share your latest idea/i), { target: { value: "Hello" } });

    const fileInput = screen.getByLabelText("Upload image") as HTMLInputElement;
    const bigBuffer = new Uint8Array(5 * 1024 * 1024 + 1);
    const bigFile = new File([bigBuffer], "big.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(screen.getByText(/image is too large/i)).toBeInTheDocument());
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

    fireEvent.change(screen.getByPlaceholderText(/share your latest idea/i), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(screen.getByText(/failed to create post/i)).toBeInTheDocument());
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("surfaces createPost errors when they are Error instances", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createPost: jest.Mock };
    };

    apiClient.createPost.mockRejectedValueOnce(new Error("API down"));

    render(<PostComposer onPostCreated={onPostCreated} />);

    fireEvent.change(screen.getByPlaceholderText(/share your latest idea/i), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(screen.getByText(/api down/i)).toBeInTheDocument());
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Keep me" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "keep.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(await screen.findByText(/could not confirm publication/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toHaveValue("Keep me");
    expect(screen.getByText("keep.png")).toBeInTheDocument();
    expect(onPostCreated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /retry original photo post/i }));
    await waitFor(() =>
      expect(apiClient.createPost).toHaveBeenLastCalledWith(
        { content: "Keep me", mediaUploadId: "upload-timeout" },
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Network draft" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "network.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(await screen.findByRole("button", { name: /retry original photo post/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toBeDisabled();
    expect(screen.getByLabelText("Upload image")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
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

    fireEvent.change(screen.getByLabelText("Post content"), {
      target: { value: "Retry the same attempt" },
    });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "retry.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    const retry = await screen.findByRole("button", { name: /retry original photo post/i });
    fireEvent.click(retry);

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(2));
    expect(apiClient.createPost).toHaveBeenNthCalledWith(
      2,
      { content: "Retry the same attempt", mediaUploadId: "retry-original-id" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /retry original photo post/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toBeDisabled();
    expect(screen.getByLabelText("Upload image")).toBeDisabled();
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
    apiClient.createPost.mockRejectedValueOnce(new ApiRequestError("Upload expired", 400));
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Correct me" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "expired.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    expect(await screen.findByText("Upload expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry original photo post/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toBeEnabled();
    expect(screen.getByLabelText("Upload image")).toBeEnabled();
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Service draft" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "service.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    await screen.findByRole("button", { name: /retry original photo post/i });
    expect(screen.getByLabelText("Post content")).toBeDisabled();
    expect(screen.getByLabelText("Upload image")).toBeDisabled();
    expect(screen.getByRole("button", { name: /ai polish/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^post$/i })).toBeDisabled();
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "PUT draft" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "put.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });
    expect(await screen.findByText(/upload timed out/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toHaveValue("PUT draft");
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Unmounted" } });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
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
      .mockRejectedValueOnce(new ApiRequestError("Upload expired", 400));
    render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Original draft" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "original.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    await screen.findByRole("button", { name: /retry original photo post/i });
    fireEvent.click(screen.getByRole("button", { name: /retry original photo post/i }));
    expect(await screen.findByText("Upload expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry original photo post/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Post content")).toBeEnabled();
    expect(screen.getByLabelText("Upload image")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Corrected draft" } });
    expect(screen.getByLabelText("Post content")).toHaveValue("Corrected draft");
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Presign" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "presign.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
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
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "PUT late" } });
    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: { files: [new File(["x"], "late.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    view.unmount();
    await act(async () => {
      resolvePut({ ok: true });
    });
    expect(apiClient.createPost).not.toHaveBeenCalled();
  });

  it("aborts AI rewrite on unmount and ignores a late rejection", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { rewritePost: jest.Mock } };
    let signal: AbortSignal | undefined;
    let rejectRewrite: (error: unknown) => void = () => {};
    apiClient.rewritePost.mockImplementationOnce((_data: unknown, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise((_resolve, reject) => {
        rejectRewrite = reject;
      });
    });
    const view = render(<PostComposer onPostCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Post content"), { target: { value: "Rewrite me" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /ai polish/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));
    await waitFor(() =>
      expect(apiClient.rewritePost).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Rewrite me" }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      rejectRewrite(new Error("late rewrite failure"));
    });
  });
});
