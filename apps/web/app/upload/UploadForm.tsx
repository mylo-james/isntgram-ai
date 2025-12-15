"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiImageAddLine } from "react-icons/ri";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function UploadForm({ isDemoUser }: { isDemoUser: boolean }) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const onSelectFile = (file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  const onUpload = async () => {
    if (isDemoUser) return;
    const content = caption.trim();
    if (!content) return;

    setSubmitting(true);
    setError(null);
    try {
      const post = await apiClient.createPost(content);
      router.push(`/posts/${post.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white px-5 py-6 min-[500px]:mt-5 min-[500px]:rounded-[3px] min-[500px]:border min-[500px]:border-[#dfdfdf]">
      <div className="mb-5 flex w-full justify-center">
        <div className="flex h-[80vw] max-h-[380px] w-[80vw] max-w-[380px] items-center justify-center overflow-hidden border border-[#dfdfdf] bg-[#fafafa] text-[#262626]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="User upload preview" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="flex flex-col items-center justify-center px-4 text-center">
              <RiImageAddLine className="h-[64px] w-[64px]" aria-hidden />
              <p className="mt-2 text-sm">Upload a Photo</p>
            </div>
          )}
        </div>
      </div>

      <label
        htmlFor="caption"
        className="mb-[5px] block w-full px-[3px] text-left text-[14px] font-bold text-[#262626]"
      >
        Add a Caption:
      </label>
      <textarea
        id="caption"
        name="caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={isDemoUser ? "Demo mode is read-only" : "Tell us about your photo..."}
        disabled={isDemoUser || submitting}
        className={cn(
          "mb-5 min-h-[77px] w-full resize-none rounded-[5px] border border-[#dfdfdf] px-[10px] py-[6px] text-sm text-[#262626] outline-none",
          "disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-gray-500",
        )}
      />

      {error ? (
        <div className="mb-4 w-full rounded-[5px] border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void onUpload()}
        disabled={isDemoUser || submitting || caption.trim().length === 0}
        className={cn(
          "h-[30px] w-full rounded-[5px] bg-[#0095f6] text-[0.9rem] font-bold text-white",
          "hover:bg-[#545972] disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {submitting ? "Uploading..." : "Upload"}
      </button>

      <input
        id="upload-file"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
      />
      <label
        htmlFor="upload-file"
        className="mt-5 flex h-[30px] w-full cursor-pointer items-center justify-center rounded-[5px] bg-[#0095f6] text-[0.9rem] font-bold text-white hover:bg-[#545972]"
      >
        Select Photo
      </label>

      <button
        type="button"
        onClick={() => router.push("/feed")}
        className="mt-5 h-[30px] w-full rounded-[5px] border border-[#0095f6] bg-white text-[0.9rem] font-bold text-[#0095f6] hover:bg-blue-50"
      >
        Go back
      </button>
    </div>
  );
}
