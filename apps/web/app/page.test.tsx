import { render, screen } from "@testing-library/react";
import Home from "./page";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Home", () => {
  const auth = jest.requireMock("@/lib/auth").auth as jest.Mock;
  const redirect = jest.requireMock("next/navigation").redirect as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the main heading for unauthenticated visitors", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    // The text is split across multiple elements, so we need to be more specific
    expect(screen.getByText("Welcome to")).toBeInTheDocument();
    expect(screen.getByText("Isntgram")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("renders the hero description", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    expect(
      screen.getByText(
        /The AI-powered social media platform that connects you with meaningful content and conversations/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders call-to-action buttons", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    expect(screen.getByText("Get Started")).toBeInTheDocument();
    expect(screen.getByText("Create Account")).toBeInTheDocument();
  });

  it("renders feature sections", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    expect(screen.getByText("AI-Powered Feed")).toBeInTheDocument();
    expect(screen.getByText("Smart Connections")).toBeInTheDocument();
    expect(screen.getByText("Privacy First")).toBeInTheDocument();
  });

  it("renders development status section", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    expect(screen.getByText("Development Status")).toBeInTheDocument();
    expect(screen.getByText("✅ Completed")).toBeInTheDocument();
    expect(screen.getByText("🔄 In Progress")).toBeInTheDocument();
  });

  it("renders completed features list", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    expect(screen.getByText(/Monorepo structure with Next.js & NestJS/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete testing infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/CI\/CD pipeline with GitHub Actions/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript configuration and linting/i)).toBeInTheDocument();
  });

  it("renders in-progress features list", async () => {
    auth.mockResolvedValue(null);
    const ui = await Home();
    render(ui);
    expect(screen.getByText(/User authentication system/i)).toBeInTheDocument();
    expect(screen.getByText(/User profile management/i)).toBeInTheDocument();
    expect(screen.getByText(/Social graph implementation/i)).toBeInTheDocument();
    expect(screen.getByText(/Post creation and feed/i)).toBeInTheDocument();
  });

  it("redirects authenticated users to /feed", async () => {
    auth.mockResolvedValue({ user: { id: "1" } });

    await Home();

    expect(redirect).toHaveBeenCalledWith("/feed");
  });
});
