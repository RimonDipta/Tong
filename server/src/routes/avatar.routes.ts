import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";

import { upload } from "../middleware/upload.middleware.js";

import { uploadAvatar } from "../controllers/avatar.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", upload.single("avatar"), uploadAvatar);

export default router;
