export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  username: string;
}
