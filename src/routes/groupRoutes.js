import { Router } from "express";
import * as groupController from "../controllers/groupController.js";

const router = Router();

// Specific static route declared before dynamic "/:id" routes.
router.get("/telegram/chats", groupController.listTelegramChats);

router.get("/", groupController.listGroups);
router.post("/", groupController.createGroup);
router.get("/:id", groupController.getGroup);
router.put("/:id", groupController.updateGroup);
router.delete("/:id", groupController.deleteGroup);
router.post("/:id/test", groupController.testGroupConnection);

export default router;
