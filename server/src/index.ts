import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { config, isAllowedOrigin } from "./config";
import { registerSocketHandlers } from "./socketHandlers";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(
  server,
  {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        console.warn(`Socket origin rechazado: ${origin ?? "desconocido"}`);
        callback(new Error("Origen no permitido"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  }
);

registerSocketHandlers(io);

type HealthResponse = {
  status: "ok";
  uptime: number;
};

app.get("/healthz", (_req, res) => {
  const payload: HealthResponse = {
    status: "ok",
    uptime: process.uptime(),
  };

  res.json(payload);
});

server.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
