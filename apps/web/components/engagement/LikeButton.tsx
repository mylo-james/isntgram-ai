'use client';

import { useState, useEffect } from 'react';
import { apiClient, LikeStatsResponse } from '../../lib/api-client';

interface LikeButtonProps {
  postId: string;
  currentUserId?: string;
  initialStats?: LikeStatsResponse;
  onLikeChange?: (stats: LikeStatsResponse) => void;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LikeButton({ 
  postId, 
  currentUserId, 
  initialStats,
  onLikeChange,
  showCount = true,
  size = 'md'
}: LikeButtonProps) {
  const [stats, setStats] = useState<LikeStatsResponse>(
    initialStats || { likesCount: 0, isLiked: false }
  );
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!initialStats && currentUserId) {
      loadStats();
    }
  }, [postId, currentUserId]);

  const loadStats = async () => {
    try {
      const newStats = await apiClient.getLikeStats(postId);
      setStats(newStats);
    } catch (error) {
      console.error('Error loading like stats:', error);
    }
  };

  const handleLikeToggle = async () => {
    if (!currentUserId || loading) return;

    setLoading(true);
    setAnimating(true);

    try {
      if (stats.isLiked) {
        await apiClient.unlikePost(postId);
        const newStats = { 
          likesCount: stats.likesCount - 1, 
          isLiked: false 
        };
        setStats(newStats);
        onLikeChange?.(newStats);
      } else {
        await apiClient.likePost(postId);
        const newStats = { 
          likesCount: stats.likesCount + 1, 
          isLiked: true 
        };
        setStats(newStats);
        onLikeChange?.(newStats);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update
      loadStats();
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 300);
    }
  };

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleLikeToggle}
        disabled={!currentUserId || loading}
        className={`
          flex items-center space-x-1 transition-colors duration-200
          ${stats.isLiked 
            ? 'text-red-500 hover:text-red-600' 
            : 'text-gray-600 hover:text-red-500'
          }
          ${!currentUserId ? 'cursor-default' : 'cursor-pointer'}
          ${animating ? 'animate-pulse' : ''}
        `}
      >
        <div className={`relative ${animating ? 'animate-bounce' : ''}`}>
          {stats.isLiked ? (
            <svg 
              className={`${sizeClasses[size]} fill-current`} 
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          ) : (
            <svg 
              className={`${sizeClasses[size]} stroke-current fill-none`} 
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          )}
        </div>
        
        {showCount && (
          <span className={`${textSizeClasses[size]} font-medium`}>
            {stats.likesCount}
          </span>
        )}
      </button>
    </div>
  );
}