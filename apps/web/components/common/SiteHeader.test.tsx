import { render, screen } from "@testing-library/react";

// Mock useRouter to avoid "app router not mounted" invariant in tests
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/feed",
}));
import SiteHeader from "./SiteHeader";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

describe("SiteHeader", () => {
  const useSession = jest.requireMock("next-auth/react").useSession as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders unauthenticated navigation", () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<SiteHeader />);

    expect(screen.queryByTestId("site-header")).not.toBeInTheDocument();
  });

  it("renders authenticated navigation with profile link and sign out", () => {
    useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "1", email: "u@example.com", name: "U", username: "user1" } },
    });

    render(<SiteHeader />);

    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByTestId("nav-authenticated")).toBeInTheDocument();
    const profileLinks = screen.getAllByRole("link", { name: "Profile" });
    expect(profileLinks.some((link) => link.getAttribute("href") === "/user1")).toBe(true);
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });
});
