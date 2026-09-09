"use client";

import { useRouter } from "next/navigation";
import PostComposer from "@/components/posts/PostComposer";

export default function UploadClient() {
  const router = useRouter();

  const handlePostCreated = () => {
    router.push("/feed");
  };

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
      <h1 className="page-heading">Create post</h1>
      <PostComposer onPostCreated={handlePostCreated} onCancel={() => router.push("/feed")} />
    </div>
  );
}
