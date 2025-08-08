import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the main heading", () => {
    render(<Home />);
    // The text is split across multiple elements, so we need to be more specific
    expect(screen.getByText("Welcome to")).toBeInTheDocument();
    expect(screen.getByText("Isntgram")).toBeInTheDocument();
  });

  it("renders the hero description", () => {
    render(<Home />);
    expect(
      screen.getByText(
        /The AI-powered social media platform that connects you with meaningful content and conversations/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders call-to-action buttons", () => {
    render(<Home />);
    expect(screen.getByText("Get Started")).toBeInTheDocument();
    expect(screen.getByText("Create Account")).toBeInTheDocument();
  });

  it("renders feature sections", () => {
    render(<Home />);
    expect(screen.getByText("AI-Powered Feed")).toBeInTheDocument();
    expect(screen.getByText("Smart Connections")).toBeInTheDocument();
    expect(screen.getByText("Privacy First")).toBeInTheDocument();
  });

  it("renders development status section", () => {
    render(<Home />);
    expect(screen.getByText("Development Status")).toBeInTheDocument();
    expect(screen.getByText("✅ Completed")).toBeInTheDocument();
    expect(screen.getByText("🔄 In Progress")).toBeInTheDocument();
  });

  it("renders completed features list", () => {
    render(<Home />);
    expect(screen.getByText(/Monorepo structure with Next.js & NestJS/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete testing infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/CI\/CD pipeline with GitHub Actions/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript configuration and linting/i)).toBeInTheDocument();
  });

  it("renders in-progress features list", () => {
    render(<Home />);
    expect(screen.getByText(/User authentication system/i)).toBeInTheDocument();
    expect(screen.getByText(/User profile management/i)).toBeInTheDocument();
    expect(screen.getByText(/Social graph implementation/i)).toBeInTheDocument();
    expect(screen.getByText(/Post creation and feed/i)).toBeInTheDocument();
  });
});
