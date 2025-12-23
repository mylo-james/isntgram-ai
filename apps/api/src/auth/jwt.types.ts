export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  tokenVersion?: number;
}

export interface AuthUser {
  userId: string;
  email: string;
  username: string;
  isDemoUser: boolean;
  isDemoSeed: boolean;
}
