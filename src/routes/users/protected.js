const express = require("express");

const router = express.Router();

const userSQL = require("../../db/users");
const {
  authenticateToken,
  requireRole,
} = require("../../middleware/authMiddleware");

// 受保护的路由示例
router.get("/api/users/profile", authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.user;

    userSQL.profile(user_id, res);
  } catch (error) {
    res.status(500).json({ error: "服务器错误" });
  }
});

router.get(
  "/api/users",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      userSQL.getUsers(res);
    } catch (error) {
      res.status(500).json({ error: "服务器错误" });
    }
  }
);

router.post("/api/users/update", authenticateToken, async (req, res) => {
  try {
    const { user_id, username, email, role } = req.body;
    const currentRole = req.user.role;
    userSQL.updateUser(user_id, username, email, role, currentRole, res);
  } catch (error) {
    res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/api/users/delete", authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.body;
    const { role } = req.user;
    userSQL.deleteUser(user_id, role, res);
  } catch (error) {
    res.status(500).json({ error: "服务器错误" });
  }
});

module.exports = router;
