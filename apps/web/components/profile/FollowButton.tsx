'use client';

import { useState } from 'react';
import Button from '../ui/Button';
import { apiClient } from '../../lib/api-client';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function FollowButton({ 
  userId, 
  isFollowing, 
  onFollowChange, 
  disabled = false,
  className = ''
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  const handleFollowToggle = async () => {
    if (loading || disabled) return;

    setLoading(true);
    try {
      if (following) {
        await apiClient.unfollowUser(userId);
        setFollowing(false);
        onFollowChange?.(false);
      } else {
        await apiClient.followUser(userId);
        setFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Optionally show error message to user
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFollowToggle}
      disabled={loading || disabled}
      variant={following ? 'outline' : 'primary'}
      className={className}
    >
      {loading ? 'Loading...' : following ? 'Unfollow' : 'Follow'}
    </Button>
  );
}