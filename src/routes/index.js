const express = require("express");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "../public/uploads" });
const path = require("path");

const compileRouter = require("./compile");
const usersProtected = require("./users/protected");
const usersPublic = require("./users/public");

router.use("/", usersProtected).use("/", usersPublic).use("/", compileRouter);

/*
router.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/dist"));
});
*/

module.exports = router;
