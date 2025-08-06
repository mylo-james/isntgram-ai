export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
