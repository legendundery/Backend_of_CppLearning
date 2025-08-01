const multer = require("multer");
const path = require("path");
const config = require("../config");

// 确保配置文件存在
if (!config.upload) {
  throw new Error("上传配置缺失，请检查.env文件");
}

// 文件类型验证
const fileFilter = (req, file, cb) => {
  const fileTypes = {
    video: ["video/mp4", "video/webm", "video/quicktime"],
    image: ["image/jpeg", "image/png", "image/webp"],
  };

  let fileType = "";

  if (file.fieldname === "video_file") {
    fileType = "video";
  } else if (file.fieldname === "cover_file") {
    fileType = "image";
  }

  if (fileTypes[fileType].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`无效的${fileType}文件类型`), false);
  }
};

// 本地存储配置
const localStorage = (uploadDir) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });
};

// 创建上传中间件
const createUploader = (type) => {
  const isVideo = type === "video";
  const fieldName = isVideo ? "video_file" : "cover_file";
  const maxSizeMB = isVideo
    ? config.upload.maxVideoSizeMB
    : config.upload.maxImageSizeMB;

  // 本地存储
  const uploadDir = isVideo ? config.upload.videoDir : config.upload.imageDir;

  return multer({
    storage: localStorage(uploadDir),
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  }).single(fieldName);
};

module.exports = {
  videoUpload: createUploader("video"),
  coverUpload: createUploader("cover"),
};
