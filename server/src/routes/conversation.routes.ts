import { Router } from "express";

import {
  addGroupMembers,
  createDirectConversation,
  createGroupConversation,
  getConversations,
  getGroupMembers,
  getMessages,
  leaveGroup,
  removeGroupMember,
  sendMessage,
} from "../controllers/conversation.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

/*
|--------------------------------------------------------------------------
| Conversations
|--------------------------------------------------------------------------
*/

router.get("/", getConversations);

router.post("/direct", createDirectConversation);

router.post("/group", createGroupConversation);

/*
|--------------------------------------------------------------------------
| Group management
|--------------------------------------------------------------------------
*/

router.get("/:conversationId/members", getGroupMembers);

router.post("/:conversationId/members", addGroupMembers);

router.delete("/:conversationId/members/:userId", removeGroupMember);

router.post("/:conversationId/leave", leaveGroup);

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

router.get("/:conversationId/messages", getMessages);

router.post("/:conversationId/messages", sendMessage);

export default router;
