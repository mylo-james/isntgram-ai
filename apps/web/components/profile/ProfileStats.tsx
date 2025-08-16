'use client';

import { useState, useEffect } from 'react';
import { apiClient, FollowStatsResponse } from '../../lib/api-client';
import { FollowersModal } from './FollowersModal';
import { FollowingModal } from './FollowingModal';

interface ProfileStatsProps {
  userId: string;
  postCount: number;
  initialFollowerCount?: number;
  initialFollowingCount?: number;
}

export function ProfileStats({ 
  userId, 
  postCount, 
  initialFollowerCount = 0, 
  initialFollowingCount = 0 
}: ProfileStatsProps) {
  const [stats, setStats] = useState<FollowStatsResponse>({
    followerCount: initialFollowerCount,
    followingCount: initialFollowingCount,
    isFollowing: false,
  });
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, [userId]);

  const loadStats = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const data = await apiClient.getFollowStats(userId);
      setStats(data);
    } catch (error) {
      console.error('Error loading follow stats:', error);
      // Keep initial values on error
    } finally {
      setLoading(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <>
      <div className="flex justify-center space-x-8 py-4 border-t border-b">
        <div className="text-center">
          <div className="text-xl font-semibold">{formatCount(postCount)}</div>
          <div className="text-sm text-gray-500">Posts</div>
        </div>
        
        <button
          onClick={() => setShowFollowersModal(true)}
          className="text-center hover:opacity-75 transition-opacity"
          disabled={loading}
        >
          <div className="text-xl font-semibold">
            {loading ? '...' : formatCount(stats.followerCount)}
          </div>
          <div className="text-sm text-gray-500">Followers</div>
        </button>
        
        <button
          onClick={() => setShowFollowingModal(true)}
          className="text-center hover:opacity-75 transition-opacity"
          disabled={loading}
        >
          <div className="text-xl font-semibold">
            {loading ? '...' : formatCount(stats.followingCount)}
          </div>
          <div className="text-sm text-gray-500">Following</div>
        </button>
      </div>

      <FollowersModal
        userId={userId}
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
      />

      <FollowingModal
        userId={userId}
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
      />
    </>
  );
}