import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FollowButton from "./FollowButton";
import { ToastProvider } from "@/components/ui/ToastProvider";
import type { ReactElement } from "react";

function renderWithToasts(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("FollowButton", () => {
  it("renders Follow when not following", () => {
    renderWithToasts(
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
    renderWithToasts(
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
    const user = userEvent.setup();

    renderWithToasts(
      <FollowButton
        username="alice"
        isFollowing={false}
        isOwnProfile={false}
        onFollow={onFollow}
        onUnfollow={onUnfollow}
      />,
    );

    const btn = screen.getByRole("button", { name: /follow alice/i });
    await user.click(btn);

    await waitFor(() => {
      expect(onFollow).toHaveBeenCalled();
    });
  });
});
