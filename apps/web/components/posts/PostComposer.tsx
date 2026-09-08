"use client";

import { useEffect, useRef, useState } from "react";
import type { PostItem } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/api-error";

type AiCapabilities = Awaited<ReturnType<typeof apiClient.getAiCapabilities>>;

const DIRECT_UPLOAD_TIMEOUT_MS = 15_000;
const PUBLICATION_TIMEOUT_MS = 30_000;

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
  const [isClientReady, setIsClientReady] = useState(false);
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [suggestedContent, setSuggestedContent] = useState<string | null>(null);
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<{
    original: string;
    accepted: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uncertainAttempt, setUncertainAttempt] = useState<{ uploadId: string; content: string } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const publishAbortRef = useRef<AbortController | null>(null);
  const rewriteAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
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

  useEffect(() => {
    mountedRef.current = true;
    setIsClientReady(true);
    return () => {
      mountedRef.current = false;
      uploadAbortRef.current?.abort();
      publishAbortRef.current?.abort();
      rewriteAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;

    void apiClient
      .getAiCapabilities()
      .then((nextCapabilities) => {
        if (!active) return;
        setCapabilities(nextCapabilities);
        setCapabilityError(null);
      })
      .catch(() => {
        if (!active) return;
        setCapabilities(null);
        setCapabilityError("AI rewriting is unavailable. You can still post your draft.");
      });

    return () => {
      active = false;
    };
  }, []);

  const composerDisabled = !isClientReady || isSubmitting || isRewriting || Boolean(uncertainAttempt);

  const resetForm = () => {
    setContent("");
    setFile(null);
    setSuggestedContent(null);
    setAcceptedSuggestion(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAiRewrite = async () => {
    if (!capabilities?.available) return;

    if (!content.trim()) {
      setError("Write something before rewriting.");
      return;
    }

    setIsRewriting(true);
    setError(null);
    const controller = new AbortController();
    rewriteAbortRef.current = controller;

    try {
      const response = await apiClient.rewritePost(
        { content: content.trim(), tone: "professional", maxLength: 2000 },
        { signal: controller.signal },
      );
      if (!mountedRef.current) return;
      setSuggestedContent(response.content);
      setAcceptedSuggestion(null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "AI rewrite failed");
    } finally {
      if (rewriteAbortRef.current === controller) rewriteAbortRef.current = null;
      if (mountedRef.current) setIsRewriting(false);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestedContent) return;
    setAcceptedSuggestion({ original: content, accepted: suggestedContent });
    setContent(suggestedContent);
    setSuggestedContent(null);
    setError(null);
  };

  const rejectSuggestion = () => {
    setSuggestedContent(null);
  };

  const undoAcceptedSuggestion = () => {
    if (!acceptedSuggestion) return;
    setContent(acceptedSuggestion.original);
    setSuggestedContent(acceptedSuggestion.accepted);
    setAcceptedSuggestion(null);
  };

  const isDefinitiveMediaRejection = (err: unknown) =>
    err instanceof ApiRequestError && [400, 401, 403, 404, 409, 413, 415, 422].includes(err.status);

  const publish = async (draft: string, uploadId?: string) => {
    const controller = new AbortController();
    publishAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), PUBLICATION_TIMEOUT_MS);
    try {
      const created = await apiClient.createPost(
        uploadId ? { content: draft, mediaUploadId: uploadId } : { content: draft },
        { signal: controller.signal },
      );
      if (!mountedRef.current) return;
      onPostCreated(created);
      setUncertainAttempt(null);
      resetForm();
    } catch (err) {
      if (!mountedRef.current) return;
      if (uploadId && !isDefinitiveMediaRejection(err)) {
        setUncertainAttempt({ uploadId, content: draft });
        setError("We could not confirm publication. Resolve this original photo post before creating another one.");
      } else {
        setUncertainAttempt(null);
        setError(err instanceof Error ? err.message : "Failed to create post");
      }
    } finally {
      window.clearTimeout(timeout);
      if (publishAbortRef.current === controller) publishAbortRef.current = null;
    }
  };

  const handleSubmit = async () => {
    const draft = content.trim();
    if (!draft) {
      setError("Write something before posting.");
      return;
    }
    if (uncertainAttempt) {
      setError("Resolve the earlier photo post before creating another one.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (!file) {
        await publish(draft);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Image is too large (max ${formatBytes(MAX_UPLOAD_BYTES)})`);
      const presign = await apiClient.createUploadUrl({
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
      });
      if (!mountedRef.current) return;
      const uploadId = presign.uploadId;
      if (!uploadId) throw new Error("Upload is misconfigured (missing upload ID).");
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), DIRECT_UPLOAD_TIMEOUT_MS);
      try {
        const upload = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
          signal: controller.signal,
        });
        if (!upload.ok) throw new Error("Upload failed");
      } catch (err) {
        if (controller.signal.aborted)
          throw new Error("Upload timed out. Your draft and selected photo are still available.");
        throw err;
      } finally {
        window.clearTimeout(timeout);
        if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      }
      if (!mountedRef.current) return;
      await publish(draft, uploadId);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  const retryUncertainAttempt = async () => {
    if (!uncertainAttempt || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    await publish(uncertainAttempt.content, uncertainAttempt.uploadId);
    if (mountedRef.current) setIsSubmitting(false);
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

          <label htmlFor="post-content" className="sr-only">
            Post content
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share your latest idea, update, or insight..."
            className="min-h-[120px] w-full resize-none rounded-sm border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-gray-400"
            maxLength={2000}
            disabled={composerDisabled}
            aria-describedby={error ? "post-composer-error" : !isClientReady ? "post-composer-status" : undefined}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <input
                ref={fileInputRef}
                id="post-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Upload image"
                onChange={(event) => {
                  uploadAbortRef.current?.abort();
                  setFile(event.target.files?.[0] ?? null);
                }}
                disabled={composerDisabled}
                className="peer sr-only"
              />
              <label
                htmlFor="post-image"
                className="inline-flex cursor-pointer items-center rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
              >
                Choose photo
              </label>
              {file ? (
                <button
                  type="button"
                  onClick={() => {
                    uploadAbortRef.current?.abort();
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={composerDisabled}
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
                disabled={composerDisabled || !capabilities?.available}
                className="rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRewriting ? "Rewriting..." : "AI polish"}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={composerDisabled}
                className="rounded-sm bg-blue-600 px-6 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
          {capabilities?.available ? <p className="mt-2 text-[11px] text-gray-500">{capabilities.label}</p> : null}
          {suggestedContent ? (
            <section aria-label="AI suggestion" className="mt-3 rounded-sm border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-gray-800">Suggested draft</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{suggestedContent}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={acceptSuggestion}
                  disabled={!isClientReady || Boolean(uncertainAttempt)}
                  className="rounded-sm bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={rejectSuggestion}
                  disabled={!isClientReady || Boolean(uncertainAttempt)}
                  className="rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400"
                >
                  Reject
                </button>
              </div>
            </section>
          ) : null}
          {acceptedSuggestion ? (
            <button
              type="button"
              onClick={undoAcceptedSuggestion}
              disabled={!isClientReady || Boolean(uncertainAttempt)}
              className="mt-3 text-xs font-semibold text-blue-700 underline underline-offset-2"
            >
              Undo accepted suggestion
            </button>
          ) : null}
          {uncertainAttempt ? (
            <section
              className="mt-3 rounded-sm border border-amber-300 bg-amber-50 p-3"
              aria-label="Uncertain photo post"
            >
              <p className="text-xs text-gray-800">
                A photo post for “{uncertainAttempt.content}” may have been published. Resolve the original attempt
                before changing this draft or photo.
              </p>
              <button
                type="button"
                onClick={retryUncertainAttempt}
                disabled={!isClientReady || isSubmitting}
                className="mt-2 rounded-sm border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retry original photo post
              </button>
            </section>
          ) : null}
          <div aria-live="polite" aria-atomic="true" className="mt-3">
            {!isClientReady ? (
              <p id="post-composer-status" role="status" className="text-xs text-gray-600">
                Preparing composer…
              </p>
            ) : null}
            {capabilityError ? <p className="text-xs text-gray-600">{capabilityError}</p> : null}
            {error ? (
              <p id="post-composer-error" role="alert" className="text-xs text-red-600">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
