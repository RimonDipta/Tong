export interface User {
  id?: string;
  _id?: string;

  name: string;
  username: string;
  email: string;

  avatar?: string;

  bio?: string;

  isVerified?: boolean;

  isOnline?: boolean;

  lastSeen?: string;

  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;

  message: string;

  accessToken: string;

  user: User;
}
