import { Router } from "express";
import * as messageController from "../controllers/messageController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", messageController.listMessages);
router.post("/", messageController.createMessage);
router.get("/:id", messageController.getMessage);
router.put("/:id", messageController.updateMessage);
router.delete("/:id", messageController.deleteMessage);

router.post("/:id/send", messageController.sendMessage);
router.post("/:id/resend", messageController.resendMessage);
router.post(
  "/:id/send-photo",
  upload.single("photo"),
  messageController.sendPhotoMessage
);
router.post(
  "/:id/send-document",
  upload.single("document"),
  messageController.sendDocumentMessage
);

export default router;
