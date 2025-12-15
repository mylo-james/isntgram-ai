import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const HASHTAG_RE = /#[a-zA-Z0-9_]+/g;

export default function PostContent({ content, className }: { content: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  const regex = new RegExp(HASHTAG_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index == null) continue;

    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      nodes.push(content.slice(lastIndex, start));
    }

    const tag = match[0].slice(1);
    nodes.push(
      <Link
        key={`tag-${start}-${end}`}
        href={`/search?q=${encodeURIComponent(`#${tag}`)}`}
        className="text-blue-700 underline underline-offset-2 hover:text-blue-800"
      >
        {match[0]}
      </Link>,
    );

    lastIndex = end;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return <p className={cn("whitespace-pre-wrap text-sm text-gray-900", className)}>{nodes}</p>;
}
