import Home from "./page";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue(null),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to /login when unauthenticated", async () => {
    await Home();
    const { redirect } = jest.requireMock("next/navigation") as { redirect: jest.Mock };
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /feed when authenticated", async () => {
    const { auth } = jest.requireMock("@/lib/auth") as { auth: jest.Mock };
    auth.mockResolvedValueOnce({ user: { id: "1" } });

    await Home();
    const { redirect } = jest.requireMock("next/navigation") as { redirect: jest.Mock };
    expect(redirect).toHaveBeenCalledWith("/feed");
  });
});
