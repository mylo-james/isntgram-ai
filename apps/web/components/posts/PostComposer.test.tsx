import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PostComposer from "./PostComposer";

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    createUploadUrl: jest.fn(),
    createPost: jest.fn(),
    rewritePost: jest.fn(),
  },
}));

describe("PostComposer", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it("does nothing in demo mode", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createPost: jest.Mock; rewritePost: jest.Mock };
    };

    render(<PostComposer onPostCreated={onPostCreated} isDemoUser />);

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "Hello demo" } });

    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));

    expect(apiClient.rewritePost).not.toHaveBeenCalled();
    expect(apiClient.createPost).not.toHaveBeenCalled();
    expect(onPostCreated).not.toHaveBeenCalled();
  });

  it("shows an error when AI polish is used with empty content", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);

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

    fireEvent.click(screen.getByRole("button", { name: /ai polish/i }));

    await waitFor(() => expect(apiClient.rewritePost).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(textarea).toHaveValue("Rewritten content."));
    expect(screen.getByText(/ai provider: mock/i)).toBeInTheDocument();
  });

  it("shows a friendly error when AI rewrite fails", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { rewritePost: jest.Mock };
    };
    apiClient.rewritePost.mockRejectedValueOnce(new Error("Provider down"));

    render(<PostComposer onPostCreated={jest.fn()} />);

    const textarea = screen.getByPlaceholderText(/share your latest idea/i);
    fireEvent.change(textarea, { target: { value: "hello world" } });

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
      publicUrl: "https://cdn.example.com/file",
      key: "file",
      expiresIn: 60,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    apiClient.createPost.mockResolvedValue({
      id: "post-1",
      content: "Hello world",
      mediaUrl: "https://cdn.example.com/file",
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

    expect(apiClient.createPost).toHaveBeenCalledWith({
      content: "Hello world",
      mediaUrl: "https://cdn.example.com/file",
    });
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

  it("shows an error when upload fails", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };

    apiClient.createUploadUrl.mockResolvedValue({
      uploadUrl: "https://example.com/upload",
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
});
