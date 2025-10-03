const multer = require("multer");
const path = require("path");
const config = require("../config");

// 确保配置文件存在
if (!config.upload) {
  throw new Error("上传配置缺失，请检查.env文件");
}

// 文件类型验证 (允许通过配置追加材料 MIME)
const baseMaterialTypes = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const materialMimeSet = new Set([
  ...baseMaterialTypes,
  ...(config.upload.allowedMaterialMimeExtra || []),
]);

const fileFilter = (req, file, cb) => {
  const fileTypes = {
    video: ["video/mp4", "video/webm", "video/quicktime"],
    image: ["image/jpeg", "image/png", "image/webp"],
    material: Array.from(materialMimeSet),
  };

  let fileType = "";
  if (file.fieldname === "video_file") fileType = "video";
  else if (file.fieldname === "cover_file") fileType = "image";
  else if (file.fieldname === "materials") fileType = "material";

  if (!fileType || !fileTypes[fileType]) {
    return cb(new Error("未知的文件字段: " + file.fieldname), false);
  }
  if (fileTypes[fileType].includes(file.mimetype)) return cb(null, true);
  return cb(new Error(`无效的${fileType}文件类型: ${file.mimetype}`), false);
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
  if (type === "materials") {
    const uploadDir = config.upload.materialDir || config.upload.videoDir;
    return multer({
      storage: localStorage(uploadDir),
      fileFilter,
      limits: {
        fileSize: (config.upload.maxMaterialSizeMB || 100) * 1024 * 1024,
      },
    }).array("materials", config.upload.maxMaterialCount || 20);
  }
  const isVideo = type === "video";
  const fieldName = isVideo ? "video_file" : "cover_file";
  const maxSizeMB = isVideo
    ? config.upload.maxVideoSizeMB
    : config.upload.maxImageSizeMB;
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
  materialsUpload: createUploader("materials"),
  // 课时创建组合上传：同时接受 video_file 与 materials，防止路由中串联两个 multer 造成 Unexpected end of form
  lessonMixedUpload: (() => {
    const multer = require("multer");
    const maxSizeMB = Math.max(
      config.upload.maxVideoSizeMB || 500,
      config.upload.maxMaterialSizeMB || 100
    );
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        if (file.fieldname === "video_file")
          return cb(null, config.upload.videoDir);
        if (file.fieldname === "materials")
          return cb(null, config.upload.materialDir || config.upload.videoDir);
        cb(new Error("未知的文件字段: " + file.fieldname));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    });
    return multer({
      storage,
      fileFilter,
      limits: { fileSize: maxSizeMB * 1024 * 1024 },
    }).fields([
      { name: "video_file", maxCount: 1 },
      { name: "materials", maxCount: config.upload.maxMaterialCount || 20 },
    ]);
  })(),
};
