import { render, screen, fireEvent } from "@testing-library/react";
import FollowButton from "./FollowButton";

describe("FollowButton", () => {
  it("renders Follow when not following", () => {
    render(
      <FollowButton
        username="alice"
        isFollowing={false}
        isOwnProfile={false}
        onFollow={async () => {}}
        onUnfollow={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /follow alice/i })).toBeInTheDocument();
  });

  it("renders Following when isFollowing is true", () => {
    render(
      <FollowButton
        username="alice"
        isFollowing={true}
        isOwnProfile={false}
        onFollow={async () => {}}
        onUnfollow={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /unfollow alice/i })).toBeInTheDocument();
    expect(screen.getByText(/following/i)).toBeInTheDocument();
  });

  it("toggles state on click calling provided handlers", async () => {
    const onFollow = jest.fn().mockResolvedValue(undefined);
    const onUnfollow = jest.fn().mockResolvedValue(undefined);

    render(
      <FollowButton
        username="alice"
        isFollowing={false}
        isOwnProfile={false}
        onFollow={onFollow}
        onUnfollow={onUnfollow}
      />,
    );

    const btn = screen.getByRole("button", { name: /follow alice/i });
    await fireEvent.click(btn);
    expect(onFollow).toHaveBeenCalled();
  });
});
