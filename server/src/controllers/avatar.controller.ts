import { Response } from "express";

import cloudinary from "../config/cloudinary.js";

import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

import User from "../models/User.js";

export async function uploadAvatar(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No image was uploaded",
      });
    }

    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Avatar must be an image",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldAvatar = user.avatar;

    const result = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "tong/avatars",

          resource_type: "image",

          transformation: [
            {
              width: 500,
              height: 500,
              crop: "fill",
              gravity: "face",
            },
          ],

          use_filename: true,

          unique_filename: true,
        },

        (error, uploadResult) => {
          if (error) {
            reject(error);
            return;
          }

          if (!uploadResult) {
            reject(new Error("Cloudinary avatar upload failed"));

            return;
          }

          resolve({
            secure_url: uploadResult.secure_url,

            public_id: uploadResult.public_id,
          });
        },
      );

      uploadStream.end(file.buffer);
    });

    user.avatar = result.secure_url;

    await user.save();

    /*
     * Delete the previous Cloudinary avatar if it
     * belongs to our Tong avatar folder.
     */
    if (oldAvatar && oldAvatar.includes("/tong/avatars/")) {
      try {
        const oldPublicId = extractCloudinaryPublicId(oldAvatar);

        if (oldPublicId) {
          await cloudinary.uploader.destroy(oldPublicId, {
            resource_type: "image",
          });
        }
      } catch (error) {
        console.error("Failed to delete old avatar:", error);
      }
    }

    return res.status(200).json({
      success: true,

      message: "Avatar uploaded successfully",

      avatar: result.secure_url,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);

    return res.status(500).json({
      success: false,

      message:
        error instanceof Error ? error.message : "Failed to upload avatar",
    });
  }
}

function extractCloudinaryPublicId(url: string) {
  try {
    const parsedUrl = new URL(url);

    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

    const uploadIndex = pathParts.indexOf("upload");

    if (uploadIndex === -1) {
      return null;
    }

    const publicIdParts = pathParts.slice(uploadIndex + 1);

    /*
     * Remove transformation segments.
     */
    while (
      publicIdParts.length > 0 &&
      (publicIdParts[0].includes(",") ||
        publicIdParts[0].startsWith("c_") ||
        publicIdParts[0].startsWith("w_") ||
        publicIdParts[0].startsWith("h_") ||
        publicIdParts[0].startsWith("g_") ||
        publicIdParts[0].startsWith("f_"))
    ) {
      publicIdParts.shift();
    }

    if (publicIdParts.length === 0) {
      return null;
    }

    const lastIndex = publicIdParts.length - 1;

    publicIdParts[lastIndex] = publicIdParts[lastIndex].replace(
      /\.[^/.]+$/,
      "",
    );

    return publicIdParts.join("/");
  } catch {
    return null;
  }
}
