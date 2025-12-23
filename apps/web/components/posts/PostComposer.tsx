"use client";

import { useEffect, useRef, useState } from "react";
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
}

export default function PostComposer({ onPostCreated }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [aiProvider, setAiProvider] = useState<"mock" | "openai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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

        try {
          const parsed = new URL(presign.publicUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Invalid upload URL");
          }
        } catch {
          throw new Error("Upload is misconfigured (invalid public URL).");
        }

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
    <div className="w-full bg-white sm:rounded-sm sm:border sm:border-gray-300">
      <div className="border-b border-gray-200 px-4 py-3">
        <p className="text-sm font-semibold text-gray-800">Create new post</p>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="flex-1">
          {previewUrl ? (
            <div className="mb-3 overflow-hidden rounded-sm border border-gray-200 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Selected image preview" className="h-auto w-full object-cover" />
            </div>
          ) : null}

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share your latest idea, update, or insight..."
            className="min-h-[120px] w-full resize-none rounded-sm border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-400"
            maxLength={2000}
            disabled={isSubmitting || isRewriting}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <input
                ref={fileInputRef}
                id="post-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Upload image"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={isSubmitting || isRewriting}
                className="peer sr-only"
              />
              <label
                htmlFor="post-image"
                className="inline-flex cursor-pointer items-center rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
              >
                Choose photo
              </label>
              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={isSubmitting || isRewriting}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
              {file ? <span className="max-w-[220px] truncate">{file.name}</span> : <span>No photo selected</span>}
              <span>
                {content.length}/2000 · Max image {formatBytes(MAX_UPLOAD_BYTES)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAiRewrite}
                disabled={isSubmitting || isRewriting}
                className="rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRewriting ? "Rewriting..." : "AI polish"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isRewriting}
                className="rounded-sm bg-blue-600 px-6 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
          {aiProvider ? <p className="mt-2 text-[11px] text-gray-500">AI provider: {aiProvider}</p> : null}
          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
