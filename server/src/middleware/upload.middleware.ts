import multer from "multer";

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  "application/pdf",

  "text/plain",

  "application/msword",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/vnd.ms-powerpoint",

  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "application/zip",
]);

export const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },

  fileFilter: (_req, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("This file type is not supported"));
  },
});
