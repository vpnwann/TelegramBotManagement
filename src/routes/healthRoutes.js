import { Router } from "express";

const router = Router();

// GET /api/health
router.get("/", (req, res) => {
  res.success({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
