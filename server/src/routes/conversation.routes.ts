import { Router } from "express";

import {
  createDirectConversation,
  getConversations,
  getMessages,
  sendMessage,
} from "../controllers/conversation.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.post("/direct", createDirectConversation);

router.get("/", getConversations);

router.get("/:conversationId/messages", getMessages);

router.post("/:conversationId/messages", sendMessage);

export default router;
