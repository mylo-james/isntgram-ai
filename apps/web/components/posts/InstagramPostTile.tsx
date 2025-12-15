"use client";

import Link from "next/link";
import { RiHeartLine } from "react-icons/ri";
import { FaRegComment } from "react-icons/fa";
import type { FeedPost } from "@/lib/api-client";
import { postPlaceholderImage } from "@/lib/placeholder-image";

export default function InstagramPostTile({ post }: { post: FeedPost }) {
  const postHref = `/posts/${post.id}`;
  const imageSrc = postPlaceholderImage(post.id);

  return (
    <Link href={postHref} className="group relative block h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="img" className="h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 hidden flex-col items-center justify-center bg-black/30 group-hover:flex">
        <div className="flex items-center text-[3.5vw] text-white min-[1000px]:text-[35px]">
          <RiHeartLine size={28} aria-hidden />
          <div className="pl-[1vw]">{post.likesCount}</div>
        </div>
        <div className="mt-3 flex items-center text-[3.5vw] text-white min-[1000px]:text-[35px]">
          <FaRegComment size={28} aria-hidden />
          <div className="pl-[1vw]">{post.commentsCount}</div>
        </div>
      </div>
    </Link>
  );
}
