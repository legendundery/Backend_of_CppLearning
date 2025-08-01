const promisePool = require("./db");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

require("dotenv").config();

async function getUsers(res) {
  try {
    const [rows, fields] = await promisePool.query(
      "SELECT * FROM users WHERE state = 1"
    );
    res.send({
      users: rows,
    });
  } catch (err) {
    console.error("查询出错:", err);
    throw err;
  }
}

async function register(username, email, role, password, res) {
  // 检查用户是否已存在
  const [existing] = await promisePool.query(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [username, email]
  );

  if (existing.length > 0) {
    return res.status(400).json({ error: "用户名或邮箱已被使用" });
  }

  // 哈希密码
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 创建用户
  const [result] = await promisePool.query(
    "INSERT INTO users (username, email,role, password_hash) VALUES (?, ?, ?,?)",
    [username, email, role, passwordHash]
  );

  res.status(201).json({
    message: "用户注册成功",
    userId: result.insertId,
  });
}

async function login(username, password, res) {
  // 查找用户
  const [users] = await promisePool.query(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [username, username]
  );

  if (users.length === 0) {
    return res.status(401).json({ error: "无效的用户名或密码" });
  }

  const user = users[0];

  // 验证密码
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: "无效的用户名或密码" });
  }

  // 生成JWT
  const token = jwt.sign({ user: user }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({
    token,
    user_id: user.user_id,
    username: user.username,
    role: user.role,
  });
}

async function profile(user_id, res) {
  const [users] = await promisePool.query(
    "SELECT user_id, username, email, role FROM users WHERE user_id = ?",
    [user_id]
  );

  if (users.length === 0) {
    return res.status(404).json({ error: "用户未找到" });
  }

  res.json(users[0]);
}

async function updateUser(
  user_id,
  username,
  email,
  role,
  currentRole,
  currentId,
  res
) {
  const [users] = await promisePool.query(
    "SELECT user_id, username, email, role FROM users WHERE user_id = ?",
    [user_id]
  );
  if (users.length === 0) {
    return res.status(404).json({ error: "用户未找到" });
  }

  if (currentRole !== "admin" && currentId !== users[0].role) {
    return res.status(401).json({ error: "无权限" });
  }

  promisePool.query(
    "UPDATE users SET username = ?, email = ?, role = ? WHERE user_id = ?",
    [username, email, role, user_id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.affectedRows === 0)
        return res.status(404).send("User not found");
      res.status(200).send({ id: user_id, ...req.body });
    }
  );
}

async function deleteUser(user_id, currentRole, currentId, res) {
  const [users] = await promisePool.query(
    "SELECT user_id, username, email, role FROM users WHERE user_id = ?",
    [user_id]
  );
  if (users.length === 0) {
    return res.status(404).json({ error: "用户未找到" });
  }

  if (currentRole !== "admin" && currentId !== users[0].user_id) {
    return res.status(401).json({ error: "无权限" });
  }

  promisePool.query(
    "UPDATE users SET state = 0 WHERE user_id = ?",
    [user_id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.affectedRows === 0)
        return res.status(404).send("User not found");
      res.status(200).send("User deleted successfully");
    }
  );
}

module.exports = { getUsers, register, login, profile, deleteUser, updateUser };
