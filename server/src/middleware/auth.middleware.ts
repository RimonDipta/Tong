import { NextFunction, Request, Response } from "express";

import User from "../models/User.js";
import { verifyAccessToken } from "../utils/token.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.userId = user._id.toString();

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
}
