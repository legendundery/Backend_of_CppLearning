const express = require("express");

const router = express.Router();

const userSQL = require("../../db/users");

router.post("/api/users/register", async (req, res) => {
  try {
    const { username, email, role, password } = req.body;

    userSQL.register(username, email, role, password, res);
  } catch (error) {
    res.status(500).json({ error: "服务器错误" });
  }
});

router.post("/api/users/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    userSQL.login(username, password, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "服务器错误" });
  }
});

module.exports = router;
