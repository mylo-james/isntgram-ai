'use client';

import { useState, useEffect } from 'react';
import { apiClient, UserProfile } from '../../lib/api-client';
import { UserListItem } from './UserListItem';

interface FollowersModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FollowersModal({ userId, isOpen, onClose }: FollowersModalProps) {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadFollowers();
    }
  }, [isOpen, userId]);

  const loadFollowers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getFollowers(userId);
      setFollowers(data);
    } catch (err) {
      setError('Failed to load followers');
      console.error('Error loading followers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Followers</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : followers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No followers yet</div>
          ) : (
            <div className="divide-y">
              {followers.map((user) => (
                <UserListItem key={user.id} user={user} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}