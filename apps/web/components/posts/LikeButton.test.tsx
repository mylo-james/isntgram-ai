import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LikeButton from "./LikeButton";
import { setPostLikeAction } from "./like-actions";

jest.mock("./like-actions", () => ({
  setPostLikeAction: jest.fn(),
}));

describe("LikeButton", () => {
  beforeEach(() => {
    (setPostLikeAction as unknown as jest.Mock).mockImplementation(async (_postId: string, shouldLike: boolean) => ({
      likedByMe: shouldLike,
      likesCount: shouldLike ? 1 : 0,
    }));
  });

  it("optimistically toggles like state and updates count", async () => {
    const user = userEvent.setup();
    render(<LikeButton postId="p1" initialLiked={false} initialCount={0} />);

    const btn = screen.getByRole("button", { name: /like post/i });
    await user.click(btn);

    expect(screen.getByRole("button", { name: /unlike post/i })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    await waitFor(() => expect(setPostLikeAction).toHaveBeenCalledWith("p1", true));

    await user.click(screen.getByRole("button", { name: /unlike post/i }));
    await waitFor(() => expect(setPostLikeAction).toHaveBeenCalledWith("p1", false));
    expect(screen.getByRole("button", { name: /like post/i })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("rolls back when the request fails", async () => {
    const user = userEvent.setup();
    (setPostLikeAction as unknown as jest.Mock).mockRejectedValue(new Error("boom"));
    const onError = jest.fn();

    render(<LikeButton postId="p1" initialLiked={false} initialCount={0} onError={onError} />);

    await user.click(screen.getByRole("button", { name: /like post/i }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("boom"));
    expect(screen.getByRole("button", { name: /like post/i })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
