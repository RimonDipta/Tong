import type { UploadApiOptions } from "cloudinary";

import cloudinary from "../config/cloudinary.js";

export interface UploadedImage {
  url: string;
  publicId: string;
}

export function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }

        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    stream.end(buffer);
  });
}

export function uploadSquareImage(buffer: Buffer, folder: string) {
  return uploadBuffer(buffer, {
    folder,
    resource_type: "image",
    transformation: [{ width: 500, height: 500, crop: "fill", gravity: "auto" }],
    unique_filename: true,
  });
}
