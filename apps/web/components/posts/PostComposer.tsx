"use client";

import { useEffect, useRef, useState } from "react";
import type { PostItem } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/api-error";

import Button from "@/components/ui/Button";
import ErrorNotice from "@/components/ui/ErrorNotice";
import Dialog from "@/components/ui/Dialog";
import { userError } from "@/lib/user-error";

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
  onCancel?: () => void;
}

export default function PostComposer({ onPostCreated, onCancel }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [mediaAltText, setMediaAltText] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertainAttempt, setUncertainAttempt] = useState<{
    uploadId: string;
    content: string;
    mediaAltText: string;
  } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const publishAbortRef = useRef<AbortController | null>(null);
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
    };
  }, []);

  const composerDisabled = !isClientReady || isSubmitting || Boolean(uncertainAttempt);

  const resetForm = () => {
    setContent("");
    setFile(null);
    setMediaAltText("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isDefinitiveMediaRejection = (err: unknown) =>
    err instanceof ApiRequestError && [400, 401, 403, 404, 409, 413, 415, 422].includes(err.status);

  const publish = async (draft: string, uploadId?: string, description = "") => {
    const controller = new AbortController();
    publishAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), PUBLICATION_TIMEOUT_MS);
    try {
      const created = await apiClient.createPost(
        uploadId ? { content: draft, mediaUploadId: uploadId, mediaAltText: description } : { content: draft },
        { signal: controller.signal },
      );
      if (!mountedRef.current) return;
      onPostCreated(created);
      setUncertainAttempt(null);
      resetForm();
    } catch (err) {
      if (!mountedRef.current) return;
      if (uploadId && !isDefinitiveMediaRejection(err)) {
        setUncertainAttempt({ uploadId, content: draft, mediaAltText: description });
        setError("We could not confirm publication. Resolve this original photo post before creating another one.");
      } else {
        setUncertainAttempt(null);
        setError(
          userError(err, "Your post wasn’t published. Your draft and selected photo are still here. Try again."),
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (publishAbortRef.current === controller) publishAbortRef.current = null;
    }
  };

  const handleSubmit = async () => {
    if (!isClientReady || busyRef.current) return;
    const draft = content.trim();
    if (!draft) {
      setError("Write something before posting.");
      return;
    }
    if (uncertainAttempt) {
      setError("Resolve the earlier photo post before creating another one.");
      return;
    }
    if (file && !mediaAltText.trim()) {
      setError("Add a photo description so people can understand the photo without seeing it.");
      document.getElementById("post-description")?.focus();
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setError(
        `This photo is too large. Choose an image up to ${formatBytes(MAX_UPLOAD_BYTES)}. Your text is still here.`,
      );
      return;
    }
    busyRef.current = true;
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
      await publish(draft, uploadId, mediaAltText.trim());
    } catch (err) {
      if (mountedRef.current)
        setError(
          userError(err, "Your post wasn’t published. Your draft and selected photo are still here. Try again."),
        );
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  const retryUncertainAttempt = async () => {
    if (!uncertainAttempt || busyRef.current) return;
    busyRef.current = true;
    setIsSubmitting(true);
    setError(null);
    await publish(uncertainAttempt.content, uncertainAttempt.uploadId, uncertainAttempt.mediaAltText);
    busyRef.current = false;
    if (mountedRef.current) setIsSubmitting(false);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      className="social-surface p-4 sm:p-6"
    >
      <div className="mb-5">
        <label htmlFor="post-content" className="mb-2 block font-medium">
          Post text (required)
        </label>
        <textarea
          id="post-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={2000}
          className="ui-field min-h-32"
          placeholder="What would you like to share?"
          disabled={composerDisabled}
          aria-invalid={Boolean(error && !content.trim())}
          aria-describedby={error ? "post-content-help post-composer-error" : "post-content-help"}
        />
        <p id="post-content-help" className="mt-2 text-sm text-gray-600">
          Text-only posts are welcome. {content.length}/2000 characters.
        </p>
      </div>
      <div className="mb-5">
        <label htmlFor="post-image" className="mb-2 block font-medium">
          Photo (optional)
        </label>
        <input
          ref={fileInputRef}
          id="post-image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="ui-field"
          disabled={composerDisabled}
          aria-describedby="post-image-help"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setMediaAltText("");
          }}
        />
        <p id="post-image-help" className="mt-2 text-sm text-gray-600">
          JPEG, PNG, WebP or GIF. Up to {formatBytes(MAX_UPLOAD_BYTES)}.
        </p>
      </div>
      {file ? (
        <div className="mb-5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={mediaAltText.trim() || "Selected photo preview"}
              className="mb-3 max-h-72 w-full rounded-xl bg-gray-50 object-contain"
            />
          ) : null}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="break-all text-sm">{file.name}</span>
            <Button
              variant="secondary"
              disabled={composerDisabled}
              onClick={() => {
                setFile(null);
                setMediaAltText("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Remove photo
            </Button>
          </div>
          <label htmlFor="post-description" className="mb-2 block font-medium">
            Photo description (required with a photo)
          </label>
          <textarea
            id="post-description"
            className="ui-field"
            value={mediaAltText}
            onChange={(e) => setMediaAltText(e.target.value)}
            disabled={composerDisabled}
            required
            maxLength={1000}
            aria-invalid={Boolean(error && !mediaAltText.trim())}
            aria-describedby={
              error && !mediaAltText.trim() ? "post-description-help post-composer-error" : "post-description-help"
            }
          />
          <p id="post-description-help" className="mt-2 text-sm text-gray-600">
            Describe what is in the photo for someone who cannot see it. Keep this separate from your post text. Up to
            1,000 characters.
          </p>
        </div>
      ) : null}
      {error ? (
        <ErrorNotice
          id="post-composer-error"
          key={error}
          message={error}
          onRetry={() => void (uncertainAttempt ? retryUncertainAttempt() : handleSubmit())}
          pending={isSubmitting}
          retryLabel={uncertainAttempt ? "Retry original photo post" : "Try posting again"}
          persistentSummary={
            uncertainAttempt
              ? "Post status is still unconfirmed. Retry the original attempt before editing."
              : undefined
          }
        />
      ) : null}
      {uncertainAttempt && !error ? (
        <div role="status" className="my-4">
          <p>Post status is still unconfirmed. Your original text, description and photo are preserved.</p>
          <Button onClick={() => void retryUncertainAttempt()} disabled={isSubmitting}>
            Retry original photo post
          </Button>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Button
          variant="secondary"
          disabled={composerDisabled}
          onClick={() => {
            if (content || file) setConfirmDiscard(true);
            else onCancel?.();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={composerDisabled} loading={isSubmitting} loadingText="Publishing…">
          Publish post
        </Button>
      </div>
      <p role="status" className="mt-3 text-sm text-gray-600">
        {!isClientReady ? "Preparing composer…" : isSubmitting ? "Publishing your post. Your draft remains here." : ""}
      </p>
      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        aria-labelledby="discard-title"
        contentClassName="w-full max-w-sm rounded-2xl bg-white p-6"
      >
        <h2 id="discard-title" className="mb-3 text-xl font-semibold">
          Discard this draft?
        </h2>
        <p className="mb-5">Your text and selected photo will be removed from this draft.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              resetForm();
              setConfirmDiscard(false);
              onCancel?.();
            }}
          >
            Discard draft
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
