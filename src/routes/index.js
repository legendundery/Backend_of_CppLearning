const express = require("express");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "../public/uploads" });
const path = require("path");

const compileRouter = require("./compile");
const usersProtected = require("./users/protected");
const usersPublic = require("./users/public");
const coursesPublic = require("./courses/public");

//router.use("/", usersProtected).use("/", usersPublic);
//router.use("/api/courses", coursesPublic);
router.use("/", compileRouter);

router.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/"));
});

module.exports = router;
