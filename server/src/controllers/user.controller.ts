import { Response } from "express";

import User from "../models/User.js";

import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

export async function searchUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.userId;

    const query = String(req.query.q || "").trim();

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (query.length < 2) {
      return res.json({
        success: true,
        users: [],
      });
    }

    const escaped = query.slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(escaped, "i");

    const users = await User.find({
      _id: {
        $ne: currentUserId,
      },

      $or: [
        {
          name: regex,
        },

        {
          username: regex,
        },

        {
          email: regex,
        },
      ],
    })
      .select("name username email avatar bio isVerified isOnline lastSeen")
      .limit(20);

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Search users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search users",
    });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,

      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isVerified: user.isVerified,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get user",
    });
  }
}

export async function updateCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { name, username, bio } = req.body;

    const updates: {
      name?: string;
      username?: string;
      bio?: string;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string") {
        return res.status(400).json({
          success: false,
          message: "Name must be a string",
        });
      }

      const cleanName = name.trim();

      if (cleanName.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Name must be at least 2 characters",
        });
      }

      if (cleanName.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Name cannot exceed 50 characters",
        });
      }

      updates.name = cleanName;
    }

    if (username !== undefined) {
      if (typeof username !== "string") {
        return res.status(400).json({
          success: false,
          message: "Username must be a string",
        });
      }

      const cleanUsername = username.trim().toLowerCase();

      if (cleanUsername.length < 3) {
        return res.status(400).json({
          success: false,
          message: "Username must be at least 3 characters",
        });
      }

      if (cleanUsername.length > 30) {
        return res.status(400).json({
          success: false,
          message: "Username cannot exceed 30 characters",
        });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        return res.status(400).json({
          success: false,
          message:
            "Username can only contain letters, numbers, and underscores",
        });
      }

      const existingUser = await User.findOne({
        username: cleanUsername,
        _id: {
          $ne: userId,
        },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Username is already taken",
        });
      }

      updates.username = cleanUsername;
    }

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res.status(400).json({
          success: false,
          message: "Bio must be a string",
        });
      }

      const cleanBio = bio.trim();

      if (cleanBio.length > 160) {
        return res.status(400).json({
          success: false,
          message: "Bio cannot exceed 160 characters",
        });
      }

      updates.bio = cleanBio;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully",

      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isVerified: user.isVerified,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
}
