import { Router } from "express";
import * as telegramBotController from "../controllers/telegramBotController.js";

const router = Router();

// NOTE: /status must be declared before /:id-style routes in general,
// but since this resource has no /:id GET route, order here is just for clarity.
router.get("/status", telegramBotController.getBotStatus);

router.post("/", telegramBotController.createBot);
router.get("/", telegramBotController.listBots);
router.put("/:id", telegramBotController.updateBot);
router.delete("/:id", telegramBotController.deleteBot);

export default router;
