const express = require("express");

const router = express.Router();

const userSQL = require("../../db/users");
const { authenticateToken } = require("../../middleware/authMiddleware");

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) return res.sendStatus(403);
    return next;
  };
};

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
    userSQL.getUsers().then((result) => {
      res.send({
        tmp: result,
      });
    });
  }
);

module.exports = router;
