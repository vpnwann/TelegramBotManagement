import dotenv from "dotenv";
import app from "./app.js";
import { startScheduler } from "./jobs/scheduler.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Telegram Bot Admin API running at http://localhost:${PORT}/api`);
  startScheduler();
});
