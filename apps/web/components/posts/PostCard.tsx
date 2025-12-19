import Link from "next/link";
import type { PostItem } from "@/lib/api-client";

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function PostCard({ post }: { post: PostItem }) {
  const initials = post.author.fullName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <Link href={`/${post.author.username}`} className="flex items-center gap-3">
          {post.author.profilePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.profilePictureUrl}
              alt={post.author.fullName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {initials || "U"}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">{post.author.fullName}</p>
            <p className="text-xs text-slate-500">@{post.author.username}</p>
          </div>
        </Link>
        <span className="text-xs text-slate-400">{formatDate(post.createdAt)}</span>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-800">{post.content}</p>

      {post.mediaUrl ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.mediaUrl} alt="Post media" className="h-72 w-full object-cover" />
        </div>
      ) : null}
    </article>
  );
}
