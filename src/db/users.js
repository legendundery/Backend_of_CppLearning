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

  const base = users[0];

  // 预设统计（防止缺表或查询失败导致 500）
  let stats = {
    enrolledCourses: 0,
    completedLessons: 0,
    totalStudyMinutes: 0,
    totalLessons: 0,
  };
  let recentActivities = [];

  try {
    const queries = [
      // totalLessons: lessons 表总行数
      promisePool
        .query("SELECT COUNT(*) AS cnt FROM lessons")
        .then(([r]) => ({ totalLessons: r[0].cnt }))
        .catch(() => ({})),
      // enrolledCourses: enrollments 表 distinct course_id
      promisePool
        .query(
          "SELECT COUNT(DISTINCT course_id) AS cnt FROM enrollments WHERE user_id = ?",
          [user_id]
        )
        .then(([r]) => ({ enrolledCourses: r[0].cnt }))
        .catch(() => ({})),
      // completedLessons: lesson_progress 表中 completed=1
      promisePool
        .query(
          "SELECT COUNT(*) AS cnt FROM lesson_progress WHERE user_id = ? AND completed = 1",
          [user_id]
        )
        .then(([r]) => ({ completedLessons: r[0].cnt }))
        .catch(() => ({})),
      // totalStudyMinutes: 优先 lesson_progress.duration_seconds 汇总
      promisePool
        .query(
          "SELECT COALESCE(SUM(duration_seconds),0) AS sec FROM lesson_progress WHERE user_id = ?",
          [user_id]
        )
        .then(([r]) => ({ totalStudyMinutes: Math.round(r[0].sec / 60) }))
        .catch(() => ({})),
      // recentActivities: 最近 10 条已完成课节 (若表存在)
      promisePool
        .query(
          "SELECT lp.lesson_id, lp.completed_at, l.title AS lesson_title, l.course_id, c.title AS course_title FROM lesson_progress lp JOIN lessons l ON lp.lesson_id = l.lesson_id JOIN courses c ON l.course_id = c.course_id WHERE lp.user_id = ? AND lp.completed = 1 ORDER BY lp.completed_at DESC LIMIT 10",
          [user_id]
        )
        .then(([r]) => ({ recentActivities: r }))
        .catch(() => ({ recentActivities: [] })),
    ];

    const results = await Promise.all(queries);
    // 合并结果
    stats = { ...stats, ...results.reduce((acc, o) => ({ ...acc, ...o }), {}) };

    // recentActivities 单独提取
    const ra = results.find((o) =>
      Object.prototype.hasOwnProperty.call(o, "recentActivities")
    );
    if (ra && ra.recentActivities) {
      recentActivities = ra.recentActivities.map((row, idx) => ({
        id: idx + 1,
        lessonId: row.lesson_id,
        courseId: row.course_id,
        course: row.course_title,
        lesson: row.lesson_title,
        time: row.completed_at,
      }));
    }
  } catch (e) {
    // 静默失败：保持最小破坏性，不中断 profile
    console.warn("profile stats aggregation failed:", e.message);
  }

  res.json({
    ...base,
    stats,
    recentActivities,
  });
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

  // 仅管理员或本人可改
  if (currentRole !== "admin" && currentId !== users[0].user_id) {
    return res.status(403).json({ error: "无权限" });
  }

  try {
    const [result] = await promisePool.query(
      "UPDATE users SET username = ?, email = ?, role = ? WHERE user_id = ?",
      [username, email, role, user_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "用户未找到" });
    }
    res.status(200).json({
      user_id,
      username,
      email,
      role,
      message: "更新成功",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "更新失败" });
  }
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
