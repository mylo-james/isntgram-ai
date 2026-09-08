import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UploadClient from "./UploadClient";
const mockPush = jest.fn();
const mockCreatePost = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/api-client", () => ({ apiClient: { createPost: (...args: unknown[]) => mockCreatePost(...args) } }));
beforeEach(() => jest.resetAllMocks());
it("returns home immediately only when cancelling an empty draft", () => {
  render(<UploadClient />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mockPush).toHaveBeenCalledWith("/feed");
  expect(mockCreatePost).not.toHaveBeenCalled();
});
it("returns home only after publication succeeds", async () => {
  mockCreatePost.mockResolvedValue({ id: "new-post" });
  render(<UploadClient />);
  fireEvent.change(screen.getByLabelText("Post text (required)"), { target: { value: "A new post" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish post" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/feed"));
  expect(mockCreatePost).toHaveBeenCalledWith(
    { content: "A new post" },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
