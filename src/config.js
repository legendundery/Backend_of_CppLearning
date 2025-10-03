require("dotenv").config();

const PORT = process.env.PORT || 1437;
const RAW_BASE = process.env.BASE_URL || `http://localhost:${PORT}`;

module.exports = {
  port: PORT,
  baseUrl: RAW_BASE.replace(/\/$/, ""),
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  upload: {
    strategy: "local",
    maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB) || 500,
    maxImageSizeMB: parseInt(process.env.MAX_IMAGE_SIZE_MB) || 5,
    dir: process.env.UPLOAD_DIR || "./uploads",
    videoDir: process.env.VIDEO_UPLOAD_DIR || "./uploads/videos",
    imageDir: process.env.IMAGE_UPLOAD_DIR || "./uploads/images",
    // 新增资料相关配置
    materialDir: process.env.MATERIAL_UPLOAD_DIR || "./uploads/materials",
    maxMaterialSizeMB: parseInt(process.env.MAX_MATERIAL_SIZE_MB) || 100, // 单文件上限 100MB
    maxMaterialCount: parseInt(process.env.MAX_MATERIAL_COUNT) || 20, // 一次批量上传最大文件数
    allowedMaterialMimeExtra: (process.env.ALLOWED_MATERIAL_MIME_EXTRA || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
};
