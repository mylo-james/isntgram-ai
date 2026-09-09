import type { PostItem } from "./api-client";

export function postDescription(post: Pick<PostItem, "mediaAltText" | "content" | "author">): string {
  return post.mediaAltText?.trim() || `Photo attached to a post by ${post.author.username}`;
}
export function postLinkLabel(post: Pick<PostItem, "mediaAltText" | "content" | "author">): string {
  return `View post by ${post.author.username}: ${post.mediaAltText?.trim() || post.content?.trim() || postDescription(post)}`;
}
