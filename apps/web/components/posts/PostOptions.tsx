"use client";

import { useState } from "react";
import Link from "next/link";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";

export default function PostOptions({
  postId,
  open,
  onClose,
  showPostLink = false,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  showPostLink?: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/post/${postId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="post-options-title"
      contentClassName="w-full max-w-sm rounded-md bg-white p-5 shadow-xl"
    >
      <h2 id="post-options-title" className="mb-4 text-lg font-semibold">
        Post options
      </h2>
      <div className="space-y-3">
        {showPostLink ? (
          <Link className="ui-action w-full border border-gray-400" href={`/post/${postId}`} onClick={onClose}>
            Go to post
          </Link>
        ) : null}
        <Button variant="secondary" className="w-full" onClick={() => void copy()}>
          Copy link
        </Button>
        {copyStatus === "copied" ? <p role="status">Link copied.</p> : null}
        {copyStatus === "failed" ? (
          <div>
            <p role="alert" className="mb-2 text-red-800">
              The link couldn’t be copied automatically. Select and copy it below.
            </p>
            <label className="block font-medium" htmlFor="post-link">
              Post link
            </label>
            <input
              id="post-link"
              readOnly
              value={url}
              className="ui-field"
              onFocus={(event) => event.target.select()}
            />
          </div>
        ) : null}
        <Button className="w-full" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
