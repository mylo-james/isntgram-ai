import { postDescription, postLinkLabel } from "./post-description";
const author = { id: "1", username: "jane", fullName: "Jane" };
it("uses the author description while keeping a caption separate", () => {
  expect(postDescription({ author, content: "Best day!", mediaAltText: " A red boat on a lake " })).toBe(
    "A red boat on a lake",
  );
  expect(postLinkLabel({ author, content: "Best day!", mediaAltText: "A red boat on a lake" })).toBe(
    "View post by jane: A red boat on a lake",
  );
});
it("does not invent a visual description from a legacy caption", () => {
  const post = { author, content: "Best day!" };
  expect(postDescription(post)).toBe("Photo attached to a post by jane");
  expect(postLinkLabel(post)).toBe("View post by jane: Best day!");
  expect(postDescription({ ...post, mediaAltText: " " })).toBe("Photo attached to a post by jane");
  expect(postLinkLabel({ author, content: "" })).toBe("View post by jane: Photo attached to a post by jane");
});
