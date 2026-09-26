import { Request, Response } from "express";

import User from "../models/User.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/token.js";
import { loginSchema, registerSchema } from "../utils/validation.js";

const refreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response) {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0]?.message ?? "Invalid input",
      });
    }

    const { name, username, email, password } = result.data;

    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or username is already in use",
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the account",
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0]?.message ?? "Invalid input",
      });
    }

    const { email, password } = result.data;

    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await comparePassword(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastSeen = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    return res.json({
      success: true,
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while logging in",
    });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is missing",
      });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    const accessToken = generateAccessToken(user._id.toString());

    return res.json({
      success: true,
      accessToken,
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
}
