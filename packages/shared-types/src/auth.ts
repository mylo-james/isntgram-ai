export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postsCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
