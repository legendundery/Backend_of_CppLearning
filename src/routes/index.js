const express = require("express");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "../public/uploads" });
const path = require("path");

const compileRouter = require("./compile");
const usersProtected = require("./users/protected");
const usersPublic = require("./users/public");
const coursesPublic = require("./courses/public");
const coursesProtected = require("./courses/protected");

// 用户相关路由（先公共再受保护，避免受保护中间件覆盖公共注册登录）
router.use("/", usersPublic).use("/", usersProtected);

// 课程相关路由: 先挂载受保护的（更具体的 manage / patch / delete），再挂载公共的避免 /:id 抢占 /manage
router.use("/", coursesProtected);
router.use("/api/courses", coursesPublic);
router.use("/", compileRouter);

router.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/"));
});

module.exports = router;
