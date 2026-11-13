import "dotenv/config";

import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import multer from "multer";
import { Server } from "socket.io";

import { connectDatabase } from "./config/database.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import avatarRoutes from "./routes/avatar.routes.js";

import { initializeSocketService } from "./services/socket.service.js";
import { registerSocketHandlers } from "./socket/handlers.js";

const app = express();

const httpServer = http.createServer(app);

/*
 * Comma-separated list of allowed web origins.
 * Trailing slashes are ignored because browsers
 * never send one in the Origin header.
 */
const CLIENT_URLS = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URLS,
    credentials: true,
  },
});

initializeSocketService(io);
registerSocketHandlers(io);

app.use(
  cors({
    origin: CLIENT_URLS,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/avatar", avatarRoutes);

app.get("/api/health", (_req, res) => {
  return res.json({
    success: true,
    message: "Tong server is running",
  });
});

app.use("/api", (_req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/*
|--------------------------------------------------------------------------
| Error handler
|--------------------------------------------------------------------------
|
| Keeps error responses JSON so the client can
| always read `message` (e.g. multer size limits).
*/

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each file must be 10 MB or smaller"
        : error.code === "LIMIT_FILE_COUNT"
          ? "You can upload a maximum of 5 files"
          : error.message;

    return res.status(400).json({ success: false, message });
  }

  if (error instanceof Error && error.message === "This file type is not supported") {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  httpServer.listen(PORT, () => {
    console.log(`Tong server running on http://localhost:${PORT}`);
  });
}

startServer();
