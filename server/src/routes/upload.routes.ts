import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";

import { upload } from "../middleware/upload.middleware.js";

import { uploadFiles } from "../controllers/upload.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", upload.array("files", 5), uploadFiles);

export default router;
