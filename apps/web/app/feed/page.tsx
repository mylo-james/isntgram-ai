'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PostsFeed } from '../../components/posts/PostsFeed';
import { CreatePostModal } from '../../components/posts/CreatePostModal';
import Button from '../../components/ui/Button';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

function FeedContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedKey, setFeedKey] = useState(0);

  const handlePostCreated = () => {
    // Refresh the feed by changing the key
    setFeedKey(prev => prev + 1);
  };

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 px-4">
          <h1 className="text-2xl font-bold text-gray-900">Your Feed</h1>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Post</span>
          </Button>
        </div>

        {/* Feed */}
        <div className="px-4">
          <PostsFeed 
            key={feedKey}
            currentUserId={session.user?.id} 
          />
        </div>

        {/* Create Post Modal */}
        <CreatePostModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onPostCreated={handlePostCreated}
        />
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedContent />
    </ProtectedRoute>
  );
}