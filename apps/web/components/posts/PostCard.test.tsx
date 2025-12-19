import { render, screen } from "@testing-library/react";
import PostCard from "./PostCard";

describe("PostCard", () => {
  const basePost = {
    id: "post-1",
    content: "Hello world",
    createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    updatedAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    author: {
      id: "user-1",
      username: "jane",
      fullName: "Jane Thompson",
      profilePictureUrl: undefined,
    },
  };

  it("renders initials when no profile picture is present", () => {
    render(<PostCard post={basePost} />);
    expect(screen.getByText("JT")).toBeInTheDocument();
    expect(screen.getByText("Jane Thompson")).toBeInTheDocument();
    expect(screen.getByText("@jane")).toBeInTheDocument();
  });

  it("renders the profile picture when provided", () => {
    render(
      <PostCard
        post={{
          ...basePost,
          author: { ...basePost.author, profilePictureUrl: "https://example.com/avatar.jpg" },
        }}
      />,
    );

    const img = screen.getByAltText("Jane Thompson") as HTMLImageElement;
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });
});
