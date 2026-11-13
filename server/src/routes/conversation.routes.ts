import { Router } from "express";

import {
  addGroupMembers,
  createDirectConversation,
  createGroupConversation,
  demoteGroupAdmin,
  getConversations,
  getGroupMembers,
  getMessages,
  leaveGroup,
  promoteGroupAdmin,
  removeGroupMember,
  sendMessage,
  updateGroup,
  updateGroupAvatar,
} from "../controllers/conversation.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

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

router.patch("/:conversationId", updateGroup);

router.post("/:conversationId/avatar", upload.single("avatar"), updateGroupAvatar);

router.get("/:conversationId/members", getGroupMembers);

router.post("/:conversationId/members", addGroupMembers);

router.delete("/:conversationId/members/:userId", removeGroupMember);

router.post("/:conversationId/admins/:userId", promoteGroupAdmin);

router.delete("/:conversationId/admins/:userId", demoteGroupAdmin);

router.post("/:conversationId/leave", leaveGroup);

/*
|--------------------------------------------------------------------------
| Messages
|--------------------------------------------------------------------------
*/

router.get("/:conversationId/messages", getMessages);

router.post("/:conversationId/messages", sendMessage);

export default router;
