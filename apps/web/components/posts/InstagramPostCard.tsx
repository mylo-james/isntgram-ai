"use client";

import Link from "next/link";
import type { FeedPost } from "@/lib/api-client";
import LikeButton from "@/components/posts/LikeButton";
import { postPlaceholderImage } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";
import { AiOutlineEllipsis } from "react-icons/ai";
import { FaRegComment } from "react-icons/fa";

function timeSince(iso: string): string {
  const timeStamp = new Date(iso);
  const now = new Date();

  const secondsPast = (now.getTime() - timeStamp.getTime()) / 1000;
  if (secondsPast < 60) return `${Math.max(0, Math.floor(secondsPast))}s`;
  if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)}m`;
  if (secondsPast <= 86400) return `${Math.floor(secondsPast / 3600)}h`;

  const day = timeStamp.getDate();
  const month = timeStamp.toDateString().split(" ")[1] ?? "";
  const year = timeStamp.getFullYear() === now.getFullYear() ? "" : ` ${timeStamp.getFullYear()}`;
  return `${day} ${month}${year}`;
}

export default function InstagramPostCard({ post, variant }: { post: FeedPost; variant?: "feed" | "detail" }) {
  const imageSrc = postPlaceholderImage(post.id);
  const profileHref = `/${post.author.username}`;
  const postHref = `/posts/${post.id}`;
  const isDetail = variant === "detail";

  return (
    <article
      className={cn(
        "w-full max-w-[600px] bg-white min-[640px]:rounded-[3px] min-[640px]:border min-[640px]:border-[#dfdfdf]",
        !isDetail && "min-[640px]:mb-[60px]",
      )}
    >
      <div className="flex h-[60px] items-center justify-between px-4">
        <div className="flex items-center">
          <Link href={profileHref} className="flex items-center">
            <div className="flex h-[37px] w-[37px] items-center justify-center overflow-hidden rounded-full bg-gray-100">
              {post.author.profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.author.profilePictureUrl}
                  alt="avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-gray-700">
                  {post.author.username.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="pl-[10px] text-[14px] font-semibold text-[#262626]">{post.author.username}</div>
          </Link>
        </div>
        <button type="button" className="m-0 border-0 bg-transparent p-0 text-[#262626]" aria-label="More options">
          <AiOutlineEllipsis size="2em" aria-hidden />
        </button>
      </div>

      <Link href={postHref} aria-label="Open post" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="w-full object-cover" src={imageSrc} alt="feed-post" />
      </Link>

      <div className="flex h-[40px] items-center justify-between px-[10px] py-[5px]">
        <div className="flex items-center gap-3">
          <LikeButton
            postId={post.id}
            initialLiked={post.likedByMe}
            initialCount={post.likesCount}
            showCount={false}
            className="border-0 px-0 py-0 hover:bg-transparent"
          />
          {!isDetail ? (
            <Link href={postHref} className="inline-flex items-center text-[#262626]" aria-label="Comment">
              <FaRegComment size={24} aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-[14px] font-semibold text-[#262626]">{post.likesCount} likes</div>
        <div className="mt-1 text-[14px] text-[#262626]">
          <Link href={profileHref} className="pr-2 font-semibold">
            {post.author.username}
          </Link>
          {post.content}
        </div>
        {!isDetail && post.commentsCount > 0 ? (
          <div className="mt-1">
            <Link href={postHref} className="text-[14px] text-[#0095f6]">
              View all {post.commentsCount} comments
            </Link>
          </div>
        ) : null}
        <div className={cn("pt-[5px] text-[11px] text-[#8e8e8e]", variant === "detail" && "pb-2")}>
          {timeSince(post.createdAt)}
        </div>

        {/* Keep the existing E2E selector working (link name "Open"). */}
        <Link href={postHref} className="sr-only">
          Open
        </Link>
      </div>
    </article>
  );
}
