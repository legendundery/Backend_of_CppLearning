const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
ffmpeg.setFfprobePath(require("ffprobe-static").path);

const router = express.Router();
const pool = require("../../db/db");
const { videoUpload, coverUpload } = require("../../middleware/upload");
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

// 创建课程 (包含文件上传)
router.post("/", handlecoverUpload, async (req, res) => {
  try {
    const { title, description, instructor_id, category } = req.body;

    // 获取上传后的文件路径

    const coverUrl =
      req.coverUrl ||
      (req.file?.path
        ? `${config.baseUrl}/uploads/images/${req.file.filename}`
        : null);

    const [result] = await pool.execute(
      `INSERT INTO courses 
         (title, description, instructor_id, category, total_duration, cover_url) 
         VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, instructor_id, category, 0, coverUrl]
    );

    res.status(201).json({
      id: result.insertId,
      cover_url: coverUrl,
      message: "课程创建成功",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "创建课程失败" });
  }
});

// 创建课程 (包含文件上传)
router.post("/lesson", handleVideoUpload, async (req, res) => {
  try {
    const { course_id, title, sort_order } = req.body;

    // 获取上传后的文件路径
    const videoUrl =
      req.videoUrl ||
      (req.file?.path
        ? `${config.baseUrl}/uploads/videos/${req.file.filename}`
        : null);

    const filePath = req.file.path;
    const duration = await getVideoDuration(filePath);

    if (!videoUrl) {
      return res.status(400).json({ error: "视频文件必须上传" });
    }
    const [result] = await pool.execute(
      `INSERT INTO lessons
         (course_id, title, video_url, duration, sort_order) 
         VALUES (?, ?, ?, ?, ?)`,
      [course_id, title, videoUrl, duration, sort_order]
    );

    res.status(201).json({
      id: result.insertId,
      video_url: videoUrl,
      message: "课程创建成功",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "创建课程失败" });
  }
});

// 获取所有课程 - GET /api/courses
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT course_id, title, instructor, category, duration_minutes, cover_url, price, is_free 
      FROM video_courses 
      WHERE publish_status = 'published'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取课程列表失败" });
  }
});

// 获取单个课程详情 - GET /api/courses/:id
router.get("/:id", async (req, res) => {
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

// 获取单个课程详情 - GET /api/courses/lessons/:id
router.get("/lessons/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM lessons WHERE course_id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "课程未找到" });
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "获取课程详情失败" });
  }
});

// 删除课程 - DELETE /api/courses/:id
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE courses SET status = 'hidden' WHERE course_id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "课程未找到" });
    }

    res.json({ message: "课程已删除" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "删除课程失败" });
  }
});

module.exports = router;
