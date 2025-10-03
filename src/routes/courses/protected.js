const express = require("express");
const router = express.Router();
const pool = require("../../db/db");

const {
  authenticateToken,
  allowRoles,
} = require("../../middleware/authMiddleware");
const { coverUpload } = require("../../middleware/upload");
const config = require("../../config");

// 所有权检查: admin 放行; teacher 需匹配 instructor_id
async function ensureCourseOwner(req, res, next) {
  try {
    if (req.user.role === "admin") return next();
    const courseId = req.params.id || req.params.courseId;
    if (!courseId) return res.status(400).json({ error: "缺少 courseId" });
    const [rows] = await pool.query(
      `SELECT course_id, instructor_id FROM courses WHERE course_id = ? AND status <> 'hidden'`,
      [courseId]
    );
    if (!rows.length) return res.status(404).json({ error: "课程不存在" });
    if (
      req.user.role === "teacher" &&
      rows[0].instructor_id !== req.user.user_id
    ) {
      return res.status(403).json({ error: "无权操作该课程" });
    }
    next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "所有权校验失败" });
  }
}

// 获取管理视图课程列表：管理员全部；教师只看自己
router.get(
  "/api/courses/manage",
  authenticateToken,
  allowRoles("admin", "teacher"),
  async (req, res) => {
    try {
      let sql = `SELECT * FROM courses WHERE status <> 'hidden'`;
      const params = [];
      if (req.user.role === "teacher") {
        sql += ` AND instructor_id = ?`;
        params.push(req.user.user_id);
      }
      sql += ` ORDER BY course_id DESC`;
      const [rows] = await pool.query(sql, params);
      return res.json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "获取课程管理列表失败" });
    }
  }
);

// 更新课程
router.patch(
  "/api/courses/:id",
  authenticateToken,
  allowRoles("admin", "teacher"),
  ensureCourseOwner,
  async (req, res) => {
    try {
      const { title, description, category, price, status, metadata } =
        req.body;
      const fields = [];
      const params = [];
      if (title !== undefined) {
        fields.push("title = ?");
        params.push(title);
      }
      if (description !== undefined) {
        fields.push("description = ?");
        params.push(description);
      }
      if (category !== undefined) {
        fields.push("category = ?");
        params.push(category);
      }
      if (price !== undefined) {
        fields.push("price = ?");
        params.push(price);
      }
      if (status !== undefined) {
        fields.push("status = ?");
        params.push(status);
      }
      if (metadata !== undefined) {
        fields.push("metadata = ?");
        params.push(JSON.stringify(metadata));
      }

      if (!fields.length)
        return res.status(400).json({ error: "无可更新字段" });
      params.push(req.params.id);

      const [result] = await pool.execute(
        `UPDATE courses SET ${fields.join(", ")} WHERE course_id = ?`,
        params
      );
      if (!result.affectedRows)
        return res.status(404).json({ error: "课程不存在" });
      return res.json({ message: "课程更新成功" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "更新课程失败" });
    }
  }
);

// 软删除课程
router.delete(
  "/api/courses/:id",
  authenticateToken,
  allowRoles("admin", "teacher"),
  ensureCourseOwner,
  async (req, res) => {
    try {
      const [result] = await pool.execute(
        `UPDATE courses SET status = 'hidden' WHERE course_id = ?`,
        [req.params.id]
      );
      if (!result.affectedRows)
        return res.status(404).json({ error: "课程不存在" });
      return res.json({ message: "课程已删除" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "删除课程失败" });
    }
  }
);

// 更新课时（不含文件）
router.patch(
  "/api/courses/:courseId/lessons/:lessonId",
  authenticateToken,
  allowRoles("admin", "teacher"),
  ensureCourseOwner,
  async (req, res) => {
    try {
      const {
        title,
        sort_order,
        metadata,
        intro_text,
        homework_text,
        materials_json,
        code_timeline_json,
      } = req.body;
      const fields = [];
      const params = [];
      if (title !== undefined) {
        fields.push("title = ?");
        params.push(title);
      }
      if (intro_text !== undefined) {
        fields.push("intro_text = ?");
        params.push(intro_text);
      }
      if (homework_text !== undefined) {
        fields.push("homework_text = ?");
        params.push(homework_text);
      }
      if (sort_order !== undefined) {
        fields.push("sort_order = ?");
        params.push(sort_order);
      }
      if (metadata !== undefined) {
        fields.push("metadata = ?");
        params.push(JSON.stringify(metadata));
      }
      if (materials_json !== undefined) {
        // expect JSON string or object/array
        let mats = materials_json;
        if (typeof mats === "object") mats = JSON.stringify(mats);
        fields.push("materials_json = ?");
        params.push(mats);
      }
      if (code_timeline_json !== undefined) {
        fields.push("code_timeline_json = ?");
        params.push(code_timeline_json);
      }
      if (!fields.length)
        return res.status(400).json({ error: "无可更新字段" });
      params.push(req.params.lessonId, req.params.courseId);
      const [result] = await pool.execute(
        `UPDATE lessons SET ${fields.join(
          ", "
        )} WHERE lesson_id = ? AND course_id = ?`,
        params
      );
      if (!result.affectedRows)
        return res.status(404).json({ error: "课时不存在" });
      return res.json({ message: "课时更新成功" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "更新课时失败" });
    }
  }
);

// 删除课时（硬删除）
router.delete(
  "/api/courses/:courseId/lessons/:lessonId",
  authenticateToken,
  allowRoles("admin", "teacher"),
  ensureCourseOwner,
  async (req, res) => {
    try {
      const [result] = await pool.execute(
        `DELETE FROM lessons WHERE lesson_id = ? AND course_id = ?`,
        [req.params.lessonId, req.params.courseId]
      );
      if (!result.affectedRows)
        return res.status(404).json({ error: "课时不存在" });
      return res.json({ message: "课时已删除" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "删除课时失败" });
    }
  }
);

module.exports = router;
// 课程封面更新 (multipart)
router.patch(
  "/api/courses/:id/cover",
  authenticateToken,
  allowRoles("admin", "teacher"),
  ensureCourseOwner,
  (req, res) => {
    coverUpload(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "未接收到封面文件" });
      try {
        const coverUrl = `${config.baseUrl}/images/${req.file.filename}`;
        const [result] = await pool.execute(
          `UPDATE courses SET cover_url = ? WHERE course_id = ?`,
          [coverUrl, req.params.id]
        );
        if (!result.affectedRows)
          return res.status(404).json({ error: "课程不存在" });
        return res.json({ message: "封面更新成功", cover_url: coverUrl });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "封面更新失败" });
      }
    });
  }
);

// 课程封面移除 (不删除物理文件，仅置空字段)
router.delete(
  "/api/courses/:id/cover",
  authenticateToken,
  allowRoles("admin", "teacher"),
  ensureCourseOwner,
  async (req, res) => {
    try {
      const [result] = await pool.execute(
        `UPDATE courses SET cover_url = NULL WHERE course_id = ?`,
        [req.params.id]
      );
      if (!result.affectedRows)
        return res.status(404).json({ error: "课程不存在" });
      return res.json({ message: "封面已移除" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "移除封面失败" });
    }
  }
);
