import jwt from "jsonwebtoken";

type TokenPayload = {
  userId: string;
};

function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not defined");
  }

  return secret;
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not defined");
  }

  return secret;
}

export function generateAccessToken(userId: string) {
  return jwt.sign(
    {
      userId,
    },
    getAccessSecret(),
    {
      expiresIn: "15m",
    },
  );
}

export function generateRefreshToken(userId: string) {
  return jwt.sign(
    {
      userId,
    },
    getRefreshSecret(),
    {
      expiresIn: "7d",
    },
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getAccessSecret()) as TokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, getRefreshSecret()) as TokenPayload;
}
