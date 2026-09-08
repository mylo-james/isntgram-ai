import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UploadClient from "./UploadClient";
const mockPush = jest.fn();
const mockCreatePost = jest.fn();
const mockCreateUploadUrl = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/api-client", () => ({
  apiClient: {
    createPost: (...args: unknown[]) => mockCreatePost(...args),
    createUploadUrl: (...args: unknown[]) => mockCreateUploadUrl(...args),
  },
}));
beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});
it("returns home immediately only when cancelling an empty draft", () => {
  render(<UploadClient />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mockPush).toHaveBeenCalledWith("/feed");
  expect(mockCreatePost).not.toHaveBeenCalled();
});
it("returns home only after publication succeeds", async () => {
  mockCreatePost.mockResolvedValue({ id: "new-post" });
  mockCreateUploadUrl.mockResolvedValue({ uploadId: "upload-1", uploadUrl: "https://example.com/upload" });
  render(<UploadClient />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Choose photo" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Choose photo"), {
    target: { files: [new File(["photo"], "new-post.png", { type: "image/png" })] },
  });
  fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "A new post" } });
  fireEvent.change(screen.getByLabelText("Photo description"), { target: { value: "A test photo" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/feed"));
  expect(mockCreatePost).toHaveBeenCalledWith(
    { content: "A new post", mediaUploadId: "upload-1", mediaAltText: "A test photo" },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
