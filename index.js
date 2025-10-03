const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./src/config");

const app = express();

// CORS 白名单 (本地开发 + 生产前端)
const allowOrigins = [
  `http://localhost:${config.port}`,
  "http://localhost:5174",
  "http://localhost:8849",
  process.env.FRONTEND_ORIGIN || "",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(express.static("public"));
app.use(express.static("dist"));
app.use(express.static("uploads"));

const router = require("./src/routes/index.js");

app.use("/", router);

app.listen(config.port, () => {
  console.log(`[server] listening at ${config.baseUrl}`);
});
