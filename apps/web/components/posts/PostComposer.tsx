"use client";

import { useRef, useState } from "react";
import type { PostItem } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const parsedMaxUploadBytes = Number(process.env.NEXT_PUBLIC_MEDIA_MAX_UPLOAD_BYTES);
const MAX_UPLOAD_BYTES = (() => {
  if (!Number.isFinite(parsedMaxUploadBytes) || parsedMaxUploadBytes <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  // Keep UI aligned with the API contract (5MB max without a code+contract change).
  return Math.min(parsedMaxUploadBytes, DEFAULT_MAX_UPLOAD_BYTES);
})();

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

interface PostComposerProps {
  onPostCreated: (post: PostItem) => void;
  isDemoUser?: boolean;
}

export default function PostComposer({ onPostCreated, isDemoUser }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [aiProvider, setAiProvider] = useState<"mock" | "openai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setContent("");
    setFile(null);
    setAiProvider(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAiRewrite = async () => {
    if (isDemoUser) return;
    if (!content.trim()) {
      setError("Write something before rewriting.");
      return;
    }

    setIsRewriting(true);
    setError(null);

    try {
      const response = await apiClient.rewritePost({
        content: content.trim(),
        tone: "professional",
        maxLength: 2000,
      });

      setContent(response.content);
      setAiProvider(response.provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI rewrite failed");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleSubmit = async () => {
    if (isDemoUser) return;
    if (!content.trim()) {
      setError("Write something before posting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let mediaUrl: string | undefined;
      if (file) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          throw new Error(`Image is too large (max ${formatBytes(MAX_UPLOAD_BYTES)})`);
        }

        const presign = await apiClient.createUploadUrl({
          fileName: file.name,
          contentType: file.type,
          contentLength: file.size,
        });

        const upload = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!upload.ok) {
          throw new Error("Upload failed");
        }

        mediaUrl = presign.publicUrl;
      }

      const created = await apiClient.createPost({
        content: content.trim(),
        mediaUrl,
      });

      onPostCreated(created);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="hidden h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 text-white sm:flex sm:items-center sm:justify-center">
          <span className="text-lg font-bold">+</span>
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share your latest idea, update, or insight..."
            className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 p-4 text-sm text-slate-800 outline-none focus:border-slate-900"
            maxLength={2000}
            disabled={isSubmitting || isRewriting || isDemoUser}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Upload image"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={isSubmitting || isRewriting || isDemoUser}
                className="text-xs"
              />
              <span>
                {content.length}/2000 · Max image {formatBytes(MAX_UPLOAD_BYTES)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAiRewrite}
                disabled={isSubmitting || isRewriting || isDemoUser}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                title={isDemoUser ? "Demo mode: posting disabled" : undefined}
              >
                {isRewriting ? "Rewriting..." : "AI polish"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isRewriting || isDemoUser}
                className="rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                title={isDemoUser ? "Demo mode: posting disabled" : undefined}
              >
                {isSubmitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
          {aiProvider ? <p className="mt-2 text-[11px] text-slate-400">AI provider: {aiProvider}</p> : null}
          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
