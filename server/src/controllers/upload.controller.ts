import { Request, Response } from "express";

import cloudinary from "../config/cloudinary.js";

export async function uploadFiles(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded",
      });
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const result = await new Promise<{
          secure_url: string;
          public_id: string;
          resource_type: string;
        }>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "tong/attachments",

              resource_type: "auto",

              use_filename: true,

              unique_filename: true,
            },

            (error, result) => {
              if (error) {
                reject(error);

                return;
              }

              if (!result) {
                reject(new Error("Cloudinary upload failed"));

                return;
              }

              resolve({
                secure_url: result.secure_url,

                public_id: result.public_id,

                resource_type: result.resource_type,
              });
            },
          );

          uploadStream.end(file.buffer);
        });

        return {
          url: result.secure_url,

          name: file.originalname,

          type: file.mimetype,

          size: file.size,

          publicId: result.public_id,

          resourceType: result.resource_type,
        };
      }),
    );

    return res.status(200).json({
      success: true,

      files: uploadedFiles,
    });
  } catch (error) {
    console.error("File upload error:", error);

    return res.status(500).json({
      success: false,

      message:
        error instanceof Error ? error.message : "Failed to upload files",
    });
  }
}
