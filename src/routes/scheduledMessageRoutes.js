import { Router } from "express";
import * as scheduledMessageController from "../controllers/scheduledMessageController.js";

const router = Router();

router.get("/", scheduledMessageController.listScheduled);
router.post("/", scheduledMessageController.createScheduled);
router.get("/:id", scheduledMessageController.getScheduled);
router.put("/:id", scheduledMessageController.updateScheduled);
router.delete("/:id", scheduledMessageController.deleteScheduled);
router.post("/:id/cancel", scheduledMessageController.cancelScheduled);
router.post("/:id/send-now", scheduledMessageController.sendNowScheduled);

export default router;
