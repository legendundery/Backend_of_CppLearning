const express = require("express");
const router = express.Router();
const pool = require("../../db/db");
const path = require("path");
const fs = require("fs");
const { materialsUpload } = require("../../middleware/upload");
const config = require("../../config");
const {
  authenticateToken,
  allowRoles,
} = require("../../middleware/authMiddleware");

// 统一错误响应
function sendError(res, code, msg) {
  return res.status(code).json({ error: msg });
}

// 上传资料 (支持多文件) POST /api/materials
router.post(
  "/api/materials",
  authenticateToken,
  allowRoles("admin", "teacher"),
  (req, res) => {
    materialsUpload(req, res, async (err) => {
      if (err) return sendError(res, 400, err.message);
      if (!req.files || !req.files.length)
        return sendError(res, 400, "未接收到资料文件");
      const base = config.baseUrl.replace(/\/$/, "");
      const conn = pool; // alias
      try {
        const insertValues = [];
        const placeholders = [];
        const { decodeOriginalName } = require("../../utils/filenameEncoding");
        for (const f of req.files) {
          const ext = path
            .extname(f.originalname)
            .toLowerCase()
            .replace(".", "");
          const decodedOriginal = decodeOriginalName(f.originalname);
          const url = `${base}/materials/${f.filename}`;
          placeholders.push("(?,?,?,?,?,?,?,NULL)");
          insertValues.push(
            decodedOriginal,
            f.filename,
            f.mimetype,
            ext || null,
            f.size,
            url,
            req.user.user_id
          );
        }
        const sql = `INSERT INTO materials (original_name, stored_name, mime_type, file_ext, size_bytes, url, uploader_id, lesson_id) VALUES ${placeholders.join(
          ","
        )}`;
        const [result] = await conn.execute(sql, insertValues);
        // 再查回刚刚插入的记录 (基于自增起点)
        const firstId = result.insertId;
        const count = req.files.length;
        const [rows] = await conn.query(
          "SELECT * FROM materials WHERE material_id BETWEEN ? AND ?",
          [firstId, firstId + count - 1]
        );
        return res.status(201).json({ message: "资料上传成功", items: rows });
      } catch (e) {
        console.error("Upload materials error:", e);
        return sendError(res, 500, "资料上传失败");
      }
    });
  }
);

// 列表 GET /api/materials?page=1&pageSize=20&ext=pdf&mime=application/pdf&kw=关键字
router.get(
  "/api/materials",
  authenticateToken,
  allowRoles("admin", "teacher"),
  async (req, res) => {
    try {
      let { page = 1, pageSize, ext, mime, kw } = req.query;
      page = parseInt(page) || 1;
      const defaultSize = config.page.defaultSize;
      const maxSize = config.page.maxSize;
      pageSize = parseInt(pageSize) || defaultSize;
      if (pageSize > maxSize) pageSize = maxSize;
      const offset = (page - 1) * pageSize;

      const where = ["deleted_at IS NULL"];
      const params = [];
      if (ext) {
        where.push("file_ext = ?");
        params.push(ext.toLowerCase());
      }
      if (mime) {
        where.push("mime_type = ?");
        params.push(mime);
      }
      if (kw) {
        where.push("original_name LIKE ?");
        params.push(`%${kw}%`);
      }

      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [rows] = await pool.query(
        `SELECT material_id, original_name, mime_type, file_ext, size_bytes, url, uploader_id, lesson_id, created_at
       FROM materials ${whereClause}
       ORDER BY material_id DESC
       LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM materials ${whereClause}`,
        params
      );
      return res.json({
        page,
        pageSize,
        total: countRows[0].total,
        items: rows,
      });
    } catch (e) {
      console.error(e);
      return sendError(res, 500, "获取资料列表失败");
    }
  }
);

// 软删除 DELETE /api/materials/:id?force=1  (force=1 -> 物理删除)
router.delete(
  "/api/materials/:id",
  authenticateToken,
  allowRoles("admin", "teacher"),
  async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return sendError(res, 400, "非法 id");
    const force = req.query.force === "1";
    try {
      if (force) {
        // 需要先找到文件名再删除
        const [rows] = await pool.query(
          "SELECT stored_name FROM materials WHERE material_id=?",
          [id]
        );
        if (!rows.length) return sendError(res, 404, "资源不存在");
        const stored = rows[0].stored_name;
        const filePath = path.join(config.upload.materialDir, stored);
        await pool.execute("DELETE FROM materials WHERE material_id=?", [id]);
        fs.promises.unlink(filePath).catch(() => {}); // 忽略文件不存在
        return res.json({ message: "资源已物理删除" });
      } else {
        const [result] = await pool.execute(
          "UPDATE materials SET deleted_at = NOW() WHERE material_id=? AND deleted_at IS NULL",
          [id]
        );
        if (!result.affectedRows)
          return sendError(res, 404, "资源不存在或已删除");
        return res.json({ message: "资源已删除" });
      }
    } catch (e) {
      console.error(e);
      return sendError(res, 500, "删除失败");
    }
  }
);

module.exports = router;
