const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
ffmpeg.setFfprobePath(require("ffprobe-static").path);

const router = express.Router();
const pool = require("../../db/db");
const {
  videoUpload,
  coverUpload,
  materialsUpload,
  lessonMixedUpload,
} = require("../../middleware/upload");
const config = require("../../config");

// 处理视频上传的中间件
const handleVideoUpload = (req, res, next) => {
  videoUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// 处理封面图上传的中间件
const handlecoverUpload = (req, res, next) => {
  coverUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// 获取视频时长的函数
const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

// 中间件
const {
  authenticateToken,
  requireRole,
  allowRoles,
} = require("../../middleware/authMiddleware");

// 创建课程 (管理员) 支持 multipart + 可选 metadata(JSON 字符串)
router.post(
  "/",
  authenticateToken,
  allowRoles("admin", "teacher"),
  handlecoverUpload,
  async (req, res) => {
    try {
      const { title, description, instructor_id, category, price, metadata } =
        req.body;

      // ---------- 输入规范化与校验，避免出现 MySQL 1366 --------------
      // multipart/form-data 下同名字段可能形成数组，如 instructor_id=["9","9"]
      const normalizeInt = (val, fallback) => {
        if (val === undefined || val === null || val === "") return fallback;
        // 如果是数组，取第一个非空元素
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item !== undefined && item !== null && item !== "") {
              val = item;
              break;
            }
          }
        }
        // 如果是对象（意外情况），尝试取其 valueOf / toString
        if (typeof val === "object") {
          try {
            val = JSON.stringify(val);
          } catch (_) {
            val = String(val);
          }
        }
        // 去掉可能的引号和空白
        if (typeof val === "string") val = val.trim().replace(/^"|"$/g, "");
        const num = Number(val);
        return Number.isInteger(num) && num >= 0 ? num : fallback;
      };

      const instructorIdFinal = normalizeInt(
        instructor_id,
        normalizeInt(req.user?.user_id, null)
      );
      if (!instructorIdFinal) {
        return res
          .status(400)
          .json({ error: "无法确定 instructor_id (未登录或字段非法)" });
      }

      const priceFinal = normalizeInt(price, 0);
      if (price !== undefined && !Number.isInteger(priceFinal)) {
        return res.status(400).json({ error: "price 需为整数" });
      }

      if (!title) return res.status(400).json({ error: "课程标题必填" });

      const coverUrl =
        req.coverUrl ||
        (req.file?.filename
          ? `${config.baseUrl.replace(/\/$/, "")}/images/${req.file.filename}`
          : null);

      let metadataJson = null;
      if (metadata) {
        try {
          metadataJson = JSON.parse(metadata);
        } catch (e) {
          return res
            .status(400)
            .json({ error: "metadata 需为合法 JSON 字符串" });
        }
      }

      const [result] = await pool.execute(
        `INSERT INTO courses 
           (title, description, instructor_id, category, price, total_duration, cover_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || "",
          instructorIdFinal,
          category || null,
          priceFinal,
          0,
          coverUrl,
        ]
      );

      res.status(201).json({
        id: result.insertId,
        cover_url: coverUrl,
        message: "课程创建成功",
        metadata: metadataJson,
      });
    } catch (err) {
      console.error(err);
      if (err && err.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD") {
        return res
          .status(400)
          .json({
            error: "字段类型不匹配，请检查 instructor_id / price 等是否为整数",
          });
      }
      res.status(500).json({ error: "创建课程失败" });
    }
  }
);

// 组合上传：视频 + 多文件资料（可选）
const handleMaterialsUpload = (req, res, next) => {
  materialsUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// 单独上传视频，不创建课时
router.post(
  "/video-only",
  authenticateToken,
  allowRoles("admin", "teacher"),
  handleVideoUpload,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "未收到视频文件" });
      let duration = 0;
      if (req.file.path) {
        try {
          const d = await getVideoDuration(req.file.path);
          duration = Number(d) || 0;
        } catch (e) {
          console.warn("获取视频时长失败", e.message);
        }
      }
      const videoUrl = `${config.baseUrl.replace(/\/$/, "")}/videos/${
        req.file.filename
      }`;
      return res.status(201).json({
        message: "视频上传成功",
        filename: req.file.filename,
        video_url: videoUrl,
        size: req.file.size,
        mime: req.file.mimetype,
        duration,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "视频上传失败" });
    }
  }
);

// 单独上传资料（多文件）
router.post(
  "/materials-only",
  authenticateToken,
  allowRoles("admin", "teacher"),
  handleMaterialsUpload,
  async (req, res) => {
    try {
      if (!Array.isArray(req.files) || !req.files.length) {
        return res.status(400).json({ error: "未收到资料文件" });
      }
      const base = config.baseUrl.replace(/\/$/, "");
      const { decodeOriginalName } = require("../../utils/filenameEncoding");
      const list = req.files.map((f) => {
        const decoded = decodeOriginalName(f.originalname);
        return {
          original: decoded,
          filename: f.filename,
          size: f.size,
          mime: f.mimetype,
          url: `${base}/materials/${f.filename}`,
        };
      });
      return res.status(201).json({ message: "资料上传成功", items: list });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "资料上传失败" });
    }
  }
);

// 创建课时 (组合上传：视频 + 资料) 使用单一 fields 解析，避免多次 multer 导致 Unexpected end of form
router.post(
  "/lesson",
  authenticateToken,
  allowRoles("admin", "teacher"),
  (req, res, next) => {
    lessonMixedUpload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const {
        course_id,
        title,
        sort_order,
        metadata,
        intro_text,
        homework_text,
        materials_json,
        code_timeline_json,
        pre_video_filename,
        pre_materials_json,
      } = req.body;
      // 新增调试日志（可在需要时移除）
      console.log("[lesson:create] body keys:", Object.keys(req.body));
      console.log(
        "[lesson:create] pre_video_filename=",
        pre_video_filename,
        " pre_materials_json length=",
        pre_materials_json ? pre_materials_json.length : 0
      );

      if (!course_id) return res.status(400).json({ error: "course_id 必填" });
      if (!title) return res.status(400).json({ error: "课时标题必填" });

      // 解析上传文件集合（multer.fields）
      const videoFiles =
        req.files && req.files["video_file"] ? req.files["video_file"] : [];
      const materialFiles =
        req.files && req.files["materials"] ? req.files["materials"] : [];

      let finalVideoFilename = null;
      if (pre_video_filename) {
        const fs = require("fs");
        const videoPath = path.join(config.upload.videoDir, pre_video_filename);
        if (!fs.existsSync(videoPath)) {
          console.warn("[lesson:create] 预上传视频文件未找到:", videoPath);
        } else {
          console.log("[lesson:create] 预上传视频文件存在:", videoPath);
        }
        finalVideoFilename = pre_video_filename; // 预上传指定
      } else if (videoFiles[0]?.filename) {
        finalVideoFilename = videoFiles[0].filename;
      }
      const videoUrl = finalVideoFilename
        ? `${config.baseUrl.replace(/\/$/, "")}/videos/${finalVideoFilename}`
        : null;

      let duration = 0;
      if (videoFiles[0]?.path) {
        try {
          const durationRaw = await getVideoDuration(videoFiles[0].path);
          duration = Number(durationRaw) > 0 ? Number(durationRaw) : 0;
        } catch (e) {
          console.warn("获取视频时长失败，使用0", e.message);
        }
      }

      let metadataJson = null;
      if (metadata) {
        try {
          metadataJson = JSON.parse(metadata);
        } catch (e) {
          return res
            .status(400)
            .json({ error: "metadata 需为合法 JSON 字符串" });
        }
      }

      // 收集上传的资料文件 + 解析前端的 materials_json
      let materialsArr = [];
      if (materials_json) {
        try {
          const parsed = JSON.parse(materials_json);
          if (Array.isArray(parsed)) materialsArr = parsed;
        } catch (e) {
          return res
            .status(400)
            .json({ error: "materials_json 需为合法 JSON" });
        }
      }
      if (pre_materials_json) {
        try {
          const parsed = JSON.parse(pre_materials_json);
          if (Array.isArray(parsed)) {
            const fs = require("fs");
            const beforeLen = parsed.length;
            const validated = parsed.filter((it) => {
              if (!it.filename) return false;
              const p = path.join(config.upload.materialDir, it.filename);
              const ok = fs.existsSync(p);
              if (!ok) console.warn("[lesson:create] 缺失预上传资料文件:", p);
              return ok;
            });
            if (validated.length !== beforeLen) {
              console.warn(
                `[lesson:create] 资料预上传有缺失: before=${beforeLen} after=${validated.length}`
              );
            }
            materialsArr = materialsArr.concat(validated);
          }
        } catch (e) {
          return res
            .status(400)
            .json({ error: "pre_materials_json 需为合法 JSON" });
        }
      }
      if (Array.isArray(materialFiles) && materialFiles.length) {
        const base = config.baseUrl.replace(/\/$/, "");
        const { decodeOriginalName } = require("../../utils/filenameEncoding");
        const list = materialFiles.map((f) => ({
          original: decodeOriginalName(f.originalname),
          filename: f.filename,
          size: f.size,
          mime: f.mimetype,
          url: `${base}/materials/${f.filename}`,
        }));
        materialsArr = materialsArr.concat(list);
      }
      console.log(
        "[lesson:create] 最终 materialsArr 长度=",
        materialsArr.length
      );
      let codeTimelineStr = code_timeline_json || null; // 前端已序列化的 JSON 字符串，可考虑压缩
      const [result] = await pool.execute(
        `INSERT INTO lessons
           (course_id, title, intro_text, homework_text, video_url, duration, materials_json, code_timeline_json, sort_order) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          course_id,
          title,
          intro_text || null,
          homework_text || null,
          videoUrl,
          duration,
          materialsArr.length ? JSON.stringify(materialsArr) : null,
          codeTimelineStr,
          sort_order || 0,
        ]
      );

      res.status(201).json({
        id: result.insertId,
        video_url: videoUrl,
        duration,
        message: "课时创建成功",
        intro_text: intro_text || null,
        homework_text: homework_text || null,
        materials_json: materialsArr,
        code_timeline_saved: !!codeTimelineStr,
        metadata: metadataJson,
      });
    } catch (err) {
      console.error("Create lesson error detail:", err);
      if (err.code === "ER_BAD_FIELD_ERROR") {
        return res
          .status(500)
          .json({ error: "数据库列不存在，请先执行迁移 (lessons 新增扩展列)" });
      }
      if (err.code === "ER_NO_REFERENCED_ROW_2") {
        return res
          .status(400)
          .json({ error: "course_id 不存在(外键约束失败)" });
      }
      if (err.code === "ER_DATA_TOO_LONG") {
        return res.status(400).json({
          error:
            "字段内容过长，请检查 intro/homework 或 code_timeline_json 大小",
        });
      }
      res.status(500).json({ error: "创建课时失败" });
    }
  }
);

// 更新课时：支持
// 1. 文本字段：title / intro_text / homework_text / sort_order / code_timeline_json
// 2. 视频：可用 pre_video_filename (预上传) 或 本次表单附带 video_file
// 3. 资料：可用 pre_materials_json 合并；也可上传新的 materials；可通过 materials_json 明确保留/替换（若传入则视为最终集合覆盖）
// 注意：若客户端不想改动视频与资料，不要传对应字段/文件
router.put(
  "/lesson/:lessonId",
  authenticateToken,
  allowRoles("admin", "teacher"),
  (req, res, next) => {
    lessonMixedUpload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    const { lessonId } = req.params;
    if (!/^\d+$/.test(lessonId))
      return res.status(400).json({ error: "lessonId 非法" });
    try {
      const [existRows] = await pool.query(
        `SELECT * FROM lessons WHERE lesson_id=?`,
        [lessonId]
      );
      if (!existRows.length)
        return res.status(404).json({ error: "课时不存在" });
      const exist = existRows[0];

      const {
        title,
        intro_text,
        homework_text,
        sort_order,
        code_timeline_json,
        materials_json, // 前端若传，表示希望最终 materials 保存为此集合（JSON字符串）
        pre_video_filename,
        pre_materials_json,
      } = req.body;

      // 处理视频：优先顺序 新上传 -> 预上传 -> 保留旧值
      const videoFiles =
        req.files && req.files["video_file"] ? req.files["video_file"] : [];
      let finalVideoUrl = exist.video_url;
      let duration = exist.duration || 0;
      if (videoFiles[0]?.filename) {
        // 新文件
        finalVideoUrl = `${config.baseUrl.replace(/\/$/, "")}/videos/${
          videoFiles[0].filename
        }`;
        if (videoFiles[0]?.path) {
          try {
            const d = await getVideoDuration(videoFiles[0].path);
            duration = Number(d) || 0;
          } catch (e) {
            console.warn("[lesson:update] 获取视频时长失败", e.message);
          }
        }
      } else if (pre_video_filename) {
        const fs = require("fs");
        const p = path.join(config.upload.videoDir, pre_video_filename);
        if (fs.existsSync(p)) {
          finalVideoUrl = `${config.baseUrl.replace(
            /\/$/,
            ""
          )}/videos/${pre_video_filename}`;
        } else {
          console.warn("[lesson:update] 预上传视频文件不存在", p);
        }
      }

      // 处理资料集合
      let finalMaterialsArr = [];
      const parseJSONSafe = (str, label) => {
        if (!str) return null;
        try {
          const parsed = JSON.parse(str);
          return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
          throw new Error(label + " 需为合法 JSON");
        }
      };
      // 如果本次显式传 materials_json 则视为最终集合（覆盖）
      if (materials_json) {
        const parsed = parseJSONSafe(materials_json, "materials_json");
        if (parsed) finalMaterialsArr = parsed;
      } else {
        // 否则从数据库现有值开始（保留原来）
        if (exist.materials_json) {
          try {
            const oldParsed = JSON.parse(exist.materials_json);
            if (Array.isArray(oldParsed)) finalMaterialsArr = oldParsed;
          } catch {}
        }
      }
      // 合并预上传 materials
      if (pre_materials_json) {
        const parsed = parseJSONSafe(pre_materials_json, "pre_materials_json");
        if (parsed && parsed.length) {
          const fs = require("fs");
          const validated = parsed.filter((it) => {
            if (!it.filename) return false;
            const p = path.join(config.upload.materialDir, it.filename);
            const ok = fs.existsSync(p);
            if (!ok) console.warn("[lesson:update] 缺失预上传资料文件:", p);
            return ok;
          });
          finalMaterialsArr = finalMaterialsArr.concat(validated);
        }
      }
      // 合并本次新上传 materials 文件
      const materialFiles =
        req.files && req.files["materials"] ? req.files["materials"] : [];
      if (materialFiles.length) {
        const base = config.baseUrl.replace(/\/$/, "");
        const { decodeOriginalName } = require("../../utils/filenameEncoding");
        const list = materialFiles.map((f) => ({
          original: decodeOriginalName(f.originalname),
          filename: f.filename,
          size: f.size,
          mime: f.mimetype,
          url: `${base}/materials/${f.filename}`,
        }));
        finalMaterialsArr = finalMaterialsArr.concat(list);
      }

      // 去重 materials（按 filename）
      if (finalMaterialsArr.length) {
        const seen = new Set();
        finalMaterialsArr = finalMaterialsArr.filter((it) => {
          if (!it || !it.filename) return false;
          if (seen.has(it.filename)) return false;
          seen.add(it.filename);
          return true;
        });
      }

      // 组装更新字段
      const fields = [];
      const params = [];
      const setField = (col, val) => {
        fields.push(`${col}=?`);
        params.push(val);
      };
      if (title !== undefined) setField("title", title || null);
      if (intro_text !== undefined) setField("intro_text", intro_text || null);
      if (homework_text !== undefined)
        setField("homework_text", homework_text || null);
      if (sort_order !== undefined) setField("sort_order", sort_order || 0);
      if (code_timeline_json !== undefined)
        setField("code_timeline_json", code_timeline_json || null);
      if (finalVideoUrl !== exist.video_url) {
        setField("video_url", finalVideoUrl);
        setField("duration", duration);
      }
      // materials 有变化或者显式传了 materials_json
      if (
        materials_json !== undefined ||
        materialFiles.length ||
        pre_materials_json
      ) {
        setField(
          "materials_json",
          finalMaterialsArr.length ? JSON.stringify(finalMaterialsArr) : null
        );
      }

      if (!fields.length) {
        return res.json({ message: "无任何变更", unchanged: true });
      }
      params.push(lessonId);
      const sql = `UPDATE lessons SET ${fields.join(", ")} WHERE lesson_id=?`;
      await pool.execute(sql, params);
      return res.json({
        message: "课时更新成功",
        updated_fields: fields.map((f) => f.split("=")[0]),
        video_url: finalVideoUrl,
        duration,
        materials_json: finalMaterialsArr,
      });
    } catch (e) {
      if (e.message && /需为合法 JSON/.test(e.message)) {
        return res.status(400).json({ error: e.message });
      }
      console.error("[lesson:update] error", e);
      return res.status(500).json({ error: "更新课时失败" });
    }
  }
);

// 删除单个资料 (仅从 materials_json 移除，不物理删除文件；如需物理删除可后续加配置)
router.delete(
  "/lesson/:lessonId/material/:filename",
  authenticateToken,
  allowRoles("admin", "teacher"),
  async (req, res) => {
    const { lessonId, filename } = req.params;
    if (!/^\d+$/.test(lessonId))
      return res.status(400).json({ error: "lessonId 非法" });
    if (!filename) return res.status(400).json({ error: "filename 必填" });
    try {
      const [rows] = await pool.query(
        `SELECT materials_json FROM lessons WHERE lesson_id=?`,
        [lessonId]
      );
      if (!rows.length) return res.status(404).json({ error: "课时不存在" });
      let arr = [];
      if (rows[0].materials_json) {
        try {
          const parsed = JSON.parse(rows[0].materials_json);
          if (Array.isArray(parsed)) arr = parsed;
        } catch {}
      }
      const before = arr.length;
      arr = arr.filter((it) => it.filename !== filename);
      if (arr.length === before) {
        return res.json({ message: "未找到该资料(或已移除)", unchanged: true });
      }
      await pool.execute(
        `UPDATE lessons SET materials_json=? WHERE lesson_id=?`,
        [arr.length ? JSON.stringify(arr) : null, lessonId]
      );
      return res.json({
        message: "资料已移除",
        removed: filename,
        remaining: arr.length,
      });
    } catch (e) {
      console.error("[lesson:remove-material] error", e);
      return res.status(500).json({ error: "移除资料失败" });
    }
  }
);

// 获取所有课程 - GET /api/courses
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM courses 
      WHERE status <> 'hidden'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取课程列表失败" });
  }
});

// 课时列表应优先于 /:id 否则会被通配
router.get("/lessons/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC, lesson_id ASC`,
      [req.params.id]
    );
    // 即使 rows 为空也返回 200，前端做空态展示
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "获取课时列表失败" });
  }
});
// 获取单个课时详情
router.get("/:courseId/lessons/:lessonId", async (req, res, next) => {
  const { courseId, lessonId } = req.params;
  if (!/^\d+$/.test(courseId) || !/^\d+$/.test(lessonId)) return next();
  try {
    const [rows] = await pool.query(
      `SELECT * FROM lessons WHERE course_id=? AND lesson_id=?`,
      [courseId, lessonId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "课时未找到" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "获取课时失败" });
  }
});
// 获取单个课程详情 - GET /api/courses/:id  (仅接受数字 id, 以避免与 /manage 等冲突)
router.get("/:id", async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next(); // 不是纯数字交给后续路由（如果有）
  try {
    const [rows] = await pool.query(
      `SELECT * FROM courses WHERE course_id = ? AND status <> 'hidden'`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "课程未找到" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取课程详情失败" });
  }
});
// 删除课程路由迁移到受保护路由中 (需鉴权 + 所有者校验)，此处移除

module.exports = router;
