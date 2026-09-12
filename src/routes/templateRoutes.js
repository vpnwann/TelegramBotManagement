import { Router } from "express";
import * as templateController from "../controllers/templateController.js";

const router = Router();

router.get("/", templateController.listTemplates);
router.post("/", templateController.createTemplate);
router.get("/:id", templateController.getTemplate);
router.put("/:id", templateController.updateTemplate);
router.delete("/:id", templateController.deleteTemplate);

export default router;
