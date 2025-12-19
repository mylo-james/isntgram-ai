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
    expect(textarea).toHaveValue("Rewritten content.");
    expect(screen.getByText(/ai provider: mock/i)).toBeInTheDocument();
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
});
