export const apiClient = {
  // Auth methods
  register: jest.fn(),
  login: jest.fn(),
  
  // User methods
  getCurrentUser: jest.fn(),
  getUserByUsername: jest.fn(),
  checkUsernameAvailability: jest.fn(),
  updateProfile: jest.fn(),
  
  // Follow methods
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  getFollowStats: jest.fn(),
  getFollowers: jest.fn(),
  getFollowing: jest.fn(),
  
  // Post methods
  createPost: jest.fn(),
  deletePost: jest.fn(),
  getPost: jest.fn(),
  getUserPosts: jest.fn().mockResolvedValue([]),
  getFeed: jest.fn().mockResolvedValue([]),
  
  // Like methods
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  getLikeStats: jest.fn().mockResolvedValue({ likesCount: 0, isLiked: false }),
  getPostLikes: jest.fn().mockResolvedValue([]),
  
  // Comment methods
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
  getComment: jest.fn(),
  getPostComments: jest.fn().mockResolvedValue([]),
  
  // Auth token methods
  setAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
};