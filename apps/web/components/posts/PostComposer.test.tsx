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

const photo = (name = "photo.png", type = "image/png") => new File(["photo"], name, { type });

const choosePhoto = (file = photo()) => {
  fireEvent.change(screen.getByLabelText("Choose photo"), { target: { files: [file] } });
};

const fillPost = () => {
  choosePhoto();
  fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "A quiet morning" } });
  fireEvent.change(screen.getByLabelText("Photo description"), { target: { value: "Sunlight on a table" } });
};

describe("PostComposer", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it("renders a custom photo picker before hydration without exposing native file-control copy", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(<PostComposer onPostCreated={jest.fn()} />);

    expect(markup).toMatch(/id="post-image"[^>]*disabled/);
    expect(markup).toContain("Choose photo");
    expect(markup).not.toContain("Choose File");
    expect(markup).not.toContain("No file chosen");
    expect(markup).not.toContain("JPEG, PNG, WebP, or GIF");
    expect(markup).not.toContain('id="post-content"');
  });

  it("reveals caption and description only after a supported photo is chosen", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());

    expect(screen.queryByLabelText("Caption")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Photo description")).not.toBeInTheDocument();
    choosePhoto();

    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
    expect(screen.getByLabelText("Photo description")).toBeInTheDocument();
    expect(screen.getByText("0/2000")).toBeInTheDocument();
    expect(screen.getByText("0/1000")).toBeInTheDocument();
  });

  it("rejects unsupported photos without discarding the selected photo or caption", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    choosePhoto(photo("kept.png"));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Keep this caption" } });
    fireEvent.change(screen.getByLabelText("Photo description"), { target: { value: "A kept photo" } });
    choosePhoto(photo("not-a-photo.pdf", "application/pdf"));

    expect(screen.getByRole("alert")).toHaveTextContent("This photo format isn’t supported");
    expect(screen.getByText("kept.png")).toBeInTheDocument();
    expect(screen.getByLabelText("Caption")).toHaveValue("Keep this caption");
    expect(screen.getByLabelText("Photo description")).toHaveValue("A kept photo");
  });

  it("previews browser-owned URLs and releases each replaced or removed photo", () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest
      .fn()
      .mockReturnValueOnce("blob:http://localhost/first")
      .mockReturnValueOnce("blob:http://localhost/second");
    URL.revokeObjectURL = jest.fn();
    const { unmount } = render(<PostComposer onPostCreated={jest.fn()} />);
    try {
      const first = photo("<script>alert(1)</script>.png");
      choosePhoto(first);
      expect(URL.createObjectURL).toHaveBeenCalledWith(first);
      expect(screen.getByRole("img", { name: "Selected photo preview" })).toHaveAttribute(
        "src",
        "blob:http://localhost/first",
      );

      choosePhoto(photo("replacement.png"));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/first");
      expect(screen.getByRole("img", { name: "Selected photo preview" })).toHaveAttribute(
        "src",
        "blob:http://localhost/second",
      );

      fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/second");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    } finally {
      unmount();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("requires a photo before it allows a caption-only publication", async () => {
    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish post" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a photo before writing your caption.");
    expect(screen.queryByLabelText("Caption")).not.toBeInTheDocument();
  });

  it("uploads the selected photo and preserves the API post payload", async () => {
    const onPostCreated = jest.fn();
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({ uploadId: "upload-1", uploadUrl: "https://example.com/upload" });
    apiClient.createPost.mockResolvedValue({ id: "post-1", content: "A quiet morning" });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<PostComposer onPostCreated={onPostCreated} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(1));
    expect(apiClient.createPost).toHaveBeenCalledWith(
      { content: "A quiet morning", mediaUploadId: "upload-1", mediaAltText: "Sunlight on a table" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(onPostCreated).toHaveBeenCalledTimes(1);
  });

  it("keeps the photo, caption, and description after upload failure", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock };
    };
    apiClient.createUploadUrl.mockRejectedValue(new Error("unavailable"));
    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft and selected photo are still here");
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByLabelText("Caption")).toHaveValue("A quiet morning");
    expect(screen.getByLabelText("Photo description")).toHaveValue("Sunlight on a table");
  });

  it("retries an uncertain publication with its original immutable payload", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "original-upload",
      uploadUrl: "https://example.com/upload",
    });
    apiClient.createPost.mockRejectedValueOnce(new TypeError("response lost")).mockResolvedValueOnce({ id: "post-1" });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await screen.findByRole("button", { name: "Retry original photo post" });
    fireEvent.click(screen.getByRole("button", { name: "Retry original photo post" }));

    await waitFor(() => expect(apiClient.createPost).toHaveBeenCalledTimes(2));
    expect(apiClient.createPost.mock.calls[1][0]).toEqual(apiClient.createPost.mock.calls[0][0]);
    expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("aborts an upload when unmounted", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({ uploadId: "upload-1", uploadUrl: "https://example.com/upload" });
    let signal: AbortSignal | undefined;
    (global.fetch as jest.Mock).mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise(() => {});
    });

    const view = render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    view.unmount();

    expect(signal?.aborted).toBe(true);
    await act(async () => {});
  });

  it("keeps a staged photo post after a failed direct upload", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { createUploadUrl: jest.Mock } };
    apiClient.createUploadUrl.mockResolvedValue({ uploadId: "upload-1", uploadUrl: "https://example.com/upload" });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft and selected photo are still here");
    expect(screen.getByLabelText("Caption")).toHaveValue("A quiet morning");
    expect(screen.getByText("photo.png")).toBeInTheDocument();
  });

  it("keeps a staged photo post when presigning returns no upload identity", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { createUploadUrl: jest.Mock } };
    apiClient.createUploadUrl.mockResolvedValue({ uploadUrl: "https://example.com/upload" });

    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft and selected photo are still here");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Photo description")).toHaveValue("Sunlight on a table");
  });

  it("retains the staged photo after the direct upload deadline", async () => {
    jest.useFakeTimers();
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { createUploadUrl: jest.Mock } };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "upload-timeout",
      uploadUrl: "https://example.com/upload",
    });
    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );

    render(<PostComposer onPostCreated={jest.fn()} />);
    await act(async () => Promise.resolve());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await act(async () => Promise.resolve());
    await act(async () => jest.advanceTimersByTime(15_000));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft and selected photo are still here");
    expect(screen.getByLabelText("Caption")).toHaveValue("A quiet morning");
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("locks an uncertain post against a second presign until its original payload is resolved", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "original-upload",
      uploadUrl: "https://example.com/upload",
    });
    apiClient.createPost.mockRejectedValue(new TypeError("response lost"));
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await screen.findByRole("button", { name: "Retry original photo post" });

    expect(screen.getByLabelText("Caption")).toBeDisabled();
    expect(screen.getByLabelText("Choose photo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish post" })).toBeDisabled();
    expect(apiClient.createUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("releases a staged photo post for correction after a definitive media rejection", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as {
      apiClient: { createUploadUrl: jest.Mock; createPost: jest.Mock };
    };
    apiClient.createUploadUrl.mockResolvedValue({
      uploadId: "rejected-upload",
      uploadUrl: "https://example.com/upload",
    });
    apiClient.createPost.mockRejectedValue(
      new ApiRequestError("Your post wasn’t published. Your draft and selected photo are still here. Try again.", 400),
    );
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your post wasn’t published");
    expect(screen.queryByRole("button", { name: "Retry original photo post" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Caption")).toBeEnabled();
    expect(screen.getByLabelText("Choose photo")).toBeEnabled();
  });

  it("stops a late presign from starting an upload after unmount", async () => {
    const { apiClient } = jest.requireMock("@/lib/api-client") as { apiClient: { createUploadUrl: jest.Mock } };
    let resolvePresign: (value: unknown) => void = () => {};
    apiClient.createUploadUrl.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePresign = resolve;
        }),
    );

    const view = render(<PostComposer onPostCreated={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
    fillPost();
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
    await waitFor(() => expect(apiClient.createUploadUrl).toHaveBeenCalled());
    view.unmount();
    await act(async () => resolvePresign({ uploadId: "late", uploadUrl: "https://example.com/upload" }));

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
