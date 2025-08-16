"use client";

import { useState } from "react";
import Button from "../ui/Button";
import { apiClient, CreatePostRequest } from "../../lib/api-client";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caption.trim() || !imageUrl.trim()) {
      setError("Both caption and image URL are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const postData: CreatePostRequest = {
        caption: caption.trim(),
        imageUrl: imageUrl.trim(),
      };

      await apiClient.createPost(postData);

      // Reset form
      setCaption("");
      setImageUrl("");

      // Notify parent component
      onPostCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;

    setCaption("");
    setImageUrl("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Create New Post</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 text-xl disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">{error}</div>}

          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Image URL
            </label>
            <input
              type="url"
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {imageUrl && (
            <div className="mt-2">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-48 object-cover rounded-md"
                onError={() => setError("Invalid image URL")}
              />
            </div>
          )}

          <div>
            <label htmlFor="caption" className="block text-sm font-medium text-gray-700 mb-1">
              Caption
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={4}
              maxLength={2200}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={loading}
            />
            <div className="text-right text-sm text-gray-500 mt-1">{caption.length}/2200</div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              loadingText="Creating..."
              disabled={!caption.trim() || !imageUrl.trim()}
            >
              Create Post
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
