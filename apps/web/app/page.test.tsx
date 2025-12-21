import { render, screen } from "@testing-library/react";
import Home from "./page";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue(null),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Home", () => {
  const renderHome = async () => {
    const view = await Home();
    render(view);
  };

  it("renders the main heading", async () => {
    await renderHome();
    expect(screen.getByText(/Build a signal-first social feed/i)).toBeInTheDocument();
  });

  it("renders the hero description", async () => {
    await renderHome();
    expect(screen.getByText(/Isntgram is a modern, AI-assisted social platform/i)).toBeInTheDocument();
  });

  it("renders call-to-action buttons", async () => {
    await renderHome();
    expect(screen.getByText("Create account")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("renders feature sections", async () => {
    await renderHome();
    expect(screen.getByText("Curated feed")).toBeInTheDocument();
    expect(screen.getByText("Instant posting")).toBeInTheDocument();
    expect(screen.getByText("Profile clarity")).toBeInTheDocument();
  });

  it("redirects to /feed when authenticated", async () => {
    const { auth } = jest.requireMock("@/lib/auth") as { auth: jest.Mock };
    auth.mockResolvedValueOnce({ user: { id: "1" } });

    await renderHome();

    const { redirect } = jest.requireMock("next/navigation") as { redirect: jest.Mock };
    expect(redirect).toHaveBeenCalledWith("/feed");
  });
});
