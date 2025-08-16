import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FollowButton } from './FollowButton';
import { apiClient } from '../../lib/api-client';

// Mock the API client
jest.mock('../../lib/api-client', () => ({
  apiClient: {
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('FollowButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders follow button when not following', () => {
    render(<FollowButton userId="user-123" isFollowing={false} />);
    
    expect(screen.getByRole('button')).toHaveTextContent('Follow');
  });

  it('renders unfollow button when following', () => {
    render(<FollowButton userId="user-123" isFollowing={true} />);
    
    expect(screen.getByRole('button')).toHaveTextContent('Unfollow');
  });

  it('calls followUser API when clicking follow button', async () => {
    mockApiClient.followUser.mockResolvedValue({
      id: 'follow-1',
      followerId: 'current-user',
      followingId: 'user-123',
      createdAt: new Date(),
    });

    render(<FollowButton userId="user-123" isFollowing={false} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toHaveTextContent('Loading...');
    
    await waitFor(() => {
      expect(mockApiClient.followUser).toHaveBeenCalledWith('user-123');
    });

    await waitFor(() => {
      expect(button).toHaveTextContent('Unfollow');
    });
  });

  it('calls unfollowUser API when clicking unfollow button', async () => {
    mockApiClient.unfollowUser.mockResolvedValue({
      message: 'Successfully unfollowed user',
    });

    render(<FollowButton userId="user-123" isFollowing={true} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toHaveTextContent('Loading...');
    
    await waitFor(() => {
      expect(mockApiClient.unfollowUser).toHaveBeenCalledWith('user-123');
    });

    await waitFor(() => {
      expect(button).toHaveTextContent('Follow');
    });
  });

  it('calls onFollowChange callback when follow state changes', async () => {
    const onFollowChange = jest.fn();
    mockApiClient.followUser.mockResolvedValue({
      id: 'follow-1',
      followerId: 'current-user',
      followingId: 'user-123',
      createdAt: new Date(),
    });

    render(
      <FollowButton 
        userId="user-123" 
        isFollowing={false} 
        onFollowChange={onFollowChange}
      />
    );
    
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(onFollowChange).toHaveBeenCalledWith(true);
    });
  });

  it('handles API errors gracefully', async () => {
    mockApiClient.followUser.mockRejectedValue(new Error('API Error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<FollowButton userId="user-123" isFollowing={false} />);
    
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error toggling follow:', expect.any(Error));
    });

    // Button should return to original state
    expect(screen.getByRole('button')).toHaveTextContent('Follow');

    consoleSpy.mockRestore();
  });

  it('disables button when disabled prop is true', () => {
    render(<FollowButton userId="user-123" isFollowing={false} disabled={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<FollowButton userId="user-123" isFollowing={false} className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});