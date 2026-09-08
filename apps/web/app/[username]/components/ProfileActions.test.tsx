import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, refresh: jest.fn() }) }));
jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));
jest.mock("@/lib/api-client", () => ({
  __esModule: true,
  apiClient: {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
    getMyProfile: jest.fn(),
    checkUsernameAvailability: jest.fn(),
    updateProfile: jest.fn(),
    logout: jest.fn(),
  },
}));
jest.mock("@/components/profile/EditProfileModal", () => ({
  __esModule: true,
  default: function MockEditProfileModal({
    initialValues,
    onSubmit,
    open,
  }: {
    initialValues: { fullName: string; username: string };
    onSubmit: (values: { fullName: string; username: string }) => Promise<void>;
    open: boolean;
  }) {
    if (!open) return null;
    return (
      <section aria-label="Edit profile">
        <p>{initialValues.fullName}</p>
        <p>{initialValues.username}</p>
        <button
          type="button"
          onClick={() => void onSubmit({ fullName: "Changed Name", username: "changed" }).catch(() => undefined)}
        >
          Save profile
        </button>
      </section>
    );
  },
}));

import ProfileActions from "./ProfileActions";

const { apiClient: mockApiClient } = jest.requireMock("@/lib/api-client") as {
  apiClient: Record<string, jest.Mock>;
};
const { signOut: mockSignOut } = jest.requireMock("next-auth/react") as { signOut: jest.Mock };

const profile = {
  id: "profile-1",
  username: "otheruser",
  fullName: "Other User",
  followerCount: 1,
  followingCount: 0,
  postCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const currentUser = { id: "viewer-1", username: "viewer" };

describe("ProfileActions follow state", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it("does not mutate an unresolved follow status", () => {
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile={false} isFollowing={null} />);

    const button = screen.getByRole("button", { name: /checking follow/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mockApiClient.followUser).not.toHaveBeenCalled();
  });

  it("offers retry for a failed status fetch without changing the relation", () => {
    const onRetryFollowStatus = jest.fn();
    render(
      <ProfileActions
        profile={profile}
        currentUser={currentUser}
        isOwnProfile={false}
        isFollowing={null}
        followStatus="error"
        onRetryFollowStatus={onRetryFollowStatus}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry follow status/i }));
    expect(onRetryFollowStatus).toHaveBeenCalledTimes(1);
    expect(mockApiClient.followUser).not.toHaveBeenCalled();
  });

  it("emits a count-affecting state only for an actual server transition", async () => {
    const onFollowChange = jest.fn();
    mockApiClient.followUser.mockResolvedValue({ isFollowing: true });
    const { rerender } = render(
      <ProfileActions
        profile={profile}
        currentUser={currentUser}
        isOwnProfile={false}
        isFollowing={false}
        onFollowChange={onFollowChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(onFollowChange).toHaveBeenCalledWith(true));

    rerender(
      <ProfileActions
        profile={profile}
        currentUser={currentUser}
        isOwnProfile={false}
        isFollowing={true}
        onFollowChange={onFollowChange}
      />,
    );
    mockApiClient.unfollowUser.mockResolvedValue({ isFollowing: true });
    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    await waitFor(() => expect(mockApiClient.unfollowUser).toHaveBeenCalledWith("otheruser"));
    expect(onFollowChange).toHaveBeenCalledTimes(1);
  });

  it("keeps known follow state and exposes a recovery error when mutation fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockApiClient.followUser.mockRejectedValue(new Error("offline"));
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile={false} isFollowing={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn't update this follow/i));
    expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled();
  });

  it("routes an unauthenticated visitor to login instead of requesting a follow", () => {
    render(<ProfileActions profile={profile} isOwnProfile={false} isFollowing={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockApiClient.followUser).not.toHaveBeenCalled();
  });

  it("opens editing with the retained profile values when the owner refresh fails", async () => {
    mockApiClient.getMyProfile.mockRejectedValue(new Error("profile unavailable"));
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));

    expect(mockApiClient.getMyProfile).toHaveBeenCalledTimes(1);
    const modal = await screen.findByRole("region", { name: "Edit profile" });
    expect(modal).toHaveTextContent("Other User");
    expect(modal).toHaveTextContent("otheruser");
  });

  it("keeps the edit modal open when its profile save rejects", async () => {
    mockApiClient.getMyProfile.mockResolvedValue({ fullName: "Fresh Name", username: "fresh" });
    mockApiClient.updateProfile.mockRejectedValue(new Error("save unavailable"));
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(mockApiClient.updateProfile).toHaveBeenCalledWith({ fullName: "Changed Name", username: "changed" }),
    );
    expect(screen.getByRole("region", { name: "Edit profile" })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith("/changed");
  });

  it("calls the API logout then clears the client session and routes to login", async () => {
    mockApiClient.logout.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile />);

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ redirect: false, callbackUrl: "/login" }));
    expect(mockApiClient.logout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("waits for API logout before client sign-out and waits for sign-out before navigation", async () => {
    let resolveLogout: (() => void) | undefined;
    let resolveSignOut: (() => void) | undefined;
    mockApiClient.logout.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve;
      }),
    );
    mockSignOut.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      }),
    );
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile />);

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(mockApiClient.logout).toHaveBeenCalledTimes(1));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith("/login");

    expect(resolveLogout).toBeDefined();
    resolveLogout?.();
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ redirect: false, callbackUrl: "/login" }));
    expect(mockPush).not.toHaveBeenCalledWith("/login");

    expect(resolveSignOut).toBeDefined();
    resolveSignOut?.();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });

  it("still clears the client session and routes after a logout API failure", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockApiClient.logout.mockRejectedValue(new Error("logout unavailable"));
    mockSignOut.mockResolvedValue(undefined);
    render(<ProfileActions profile={profile} currentUser={currentUser} isOwnProfile />);

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledWith({ redirect: false, callbackUrl: "/login" }));
    expect(mockApiClient.logout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
