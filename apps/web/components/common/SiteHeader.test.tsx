import { render, screen } from "@testing-library/react";

// Mock useRouter to avoid "app router not mounted" invariant in tests
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
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

    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByText("Isntgram")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Log in")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toBeInTheDocument();
  });

  it("renders authenticated navigation with profile link and sign out", () => {
    useSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "1", email: "u@example.com", name: "U", username: "user1" } },
    });

    render(<SiteHeader />);

    expect(screen.getByTestId("nav-authenticated")).toBeInTheDocument();
    expect(screen.getByTestId("nav-profile-link")).toHaveAttribute("href", "/user1");
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });
});
