const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./src/config");

const app = express();

// 解析 JSON 必须放最前（在任何路由前）
app.use(express.json());

// ===== CORS =====
/**
 * 支持：
 * 1. 本地调试端口 (5173/5174)
 * 2. 后端自身端口 (用于直接调试)
 * 3. .env 中 FRONTEND_ORIGIN / FRONTEND_ORIGINS (逗号分隔)
 * 4. 自动从 BASE_URL 推导 (仅域名 / IP，不含端口时忽略端口差异)
 */
function extractOrigin(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return null;
  }
}
const envOrigins = (
  process.env.FRONTEND_ORIGINS ||
  process.env.FRONTEND_ORIGIN ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const baseOrigin = extractOrigin(config.baseUrl);

const allowOrigins = Array.from(
  new Set(
    [
      baseOrigin,
      `http://localhost:${config.port}`,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:8849",
      ...envOrigins,
    ].filter(Boolean)
  )
);

console.log("[CORS allowOrigins]", allowOrigins);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / 内部请求
      if (allowOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

// ===== 基础请求日志 & 慢请求监控 =====
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (ms > 1000) {
      console.log(
        `[SLOW] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`
      );
    }
  });
  next();
});

// ===== 健康检查 =====
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: Date.now() });
});

// 静态目录（不影响 /api/*）
app.use(express.static("public"));
app.use(express.static("dist"));
app.use("/uploads", express.static("uploads"));

const router = require("./src/routes/index.js");
app.use("/", router);

// ===== 统一 404 (仅 API) =====
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ code: "NOT_FOUND", message: "接口不存在" });
  }
  next();
});

// ===== 统一错误处理 =====
app.use((err, req, res, next) => {
  console.error("[ERROR]", req.method, req.originalUrl, err.message);
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }
  if (res.headersSent) return next(err);
  // CORS 被拦截的错误也会到这里
  if (/CORS blocked/.test(err.message)) {
    return res
      .status(403)
      .json({
        code: "CORS_DENY",
        message: "来源不被允许",
        origin: req.headers.origin,
      });
  }
  res.status(500).json({ code: "INTERNAL_ERROR", message: "服务器内部错误" });
});

app.listen(config.port, () => {
  console.log(`[server] listening at ${config.baseUrl}`);
});
