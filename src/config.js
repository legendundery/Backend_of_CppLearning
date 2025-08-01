require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  baseUrl: "localhost:" + process.env.PORT || 3000,
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
  },
};
