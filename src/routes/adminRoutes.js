import { Router } from "express";
import * as adminController from "../controllers/adminController.js";

const router = Router();

router.get("/dashboard", adminController.getDashboard);
router.get("/recent-messages", adminController.getRecentMessages);
router.get("/recent-scheduled", adminController.getRecentScheduled);

export default router;
