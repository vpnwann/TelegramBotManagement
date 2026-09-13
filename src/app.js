import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { responseHelpers } from "./middleware/response.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

import healthRoutes from "./routes/healthRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import telegramBotRoutes from "./routes/telegramBotRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import scheduledMessageRoutes from "./routes/scheduledMessageRoutes.js";

dotenv.config();

const app = express();

// ---- Global middleware ----
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseHelpers);

// ---- Routes ----
app.use("/api/health", healthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/telegram", telegramBotRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/scheduled", scheduledMessageRoutes);

// ---- 404 + error handling ----
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
