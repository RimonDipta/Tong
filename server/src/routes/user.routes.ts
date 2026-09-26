import { Router } from "express";

import {
  getCurrentUser,
  searchUsers,
  updateCurrentUser,
} from "../controllers/user.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/search", searchUsers);

router.get("/me", getCurrentUser);

router.patch("/me", updateCurrentUser);

export default router;
