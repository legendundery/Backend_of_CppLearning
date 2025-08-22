const express = require("express");

const router = express.Router();

const fs = require("fs");
const CppCompiler = require("../api/CppCompiler");
const Codebugger = require("../api/Codedebugger");
const CodeRunner = require("../api/CodeRunner");
const CodeDebugger = require("../api/Codedebugger");

router.post("/api/compile/cpp", (req, res) => {
  const code = req.body.code;
  var input = req.body.input;
  const path_name = "./public/Code/";
  const file_name = "text";
  fs.writeFile(path_name + file_name + ".cpp", code, (err) => {
    if (err) {
      console.error("Error Writing File:", err);
      return;
    }
    fs.writeFile(
      path_name + file_name + "Input" + ".txt",
      input + "\n",
      (err) => {
        if (err) {
          console.error("Error Writing Input File:", err);
          return;
        }
        console.log("File Written successfully");
        CppCompiler(res, path_name, file_name, CodeRunner);
      }
    );
  });
});

router.post("/api/debug/cpp", (req, res) => {
  const code = req.body.code;
  var input = req.body.input;
  const path_name = "./public/Code/";
  const file_name = "text";
  fs.writeFile(path_name + file_name + ".cpp", code, (err) => {
    if (err) {
      console.error("Error Writing File:", err);
      return;
    }
    fs.writeFile(
      path_name + file_name + "Input" + ".txt",
      input + "\n",
      (err) => {
        if (err) {
          console.error("Error Writing Input File:", err);
          return;
        }
        console.log("File Written successfully");
        CppCompiler(res, path_name, file_name, CodeDebugger);
      }
    );
  });
});

module.exports = router;
