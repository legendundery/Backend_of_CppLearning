const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { CXX } = require("./util/toolPath");

module.exports = function CppCompiler(res, pathName, fileName, RunnerModule) {
  const src = path.join(pathName, fileName + ".cpp");
  const out = path.join(pathName, fileName + ".out");
  const args = ["-std=c++17", src, "-O2", "-o", out];

  const p = spawn(CXX, args, { stdio: ["ignore", "pipe", "pipe"] });

  let stderr = "";
  p.stderr.on("data", (d) => (stderr += d.toString()));
  p.on("error", (err) => {
    if (err.code === "ENOENT") {
      return res.status(200).send({
        success: false,
        stage: "compile",
        error: "未找到 g++ (CXX_PATH)",
      });
    }
    return res
      .status(200)
      .send({ success: false, stage: "compile", error: err.message });
  });
  p.on("close", (code) => {
    if (code !== 0) {
      return res.status(200).send({
        success: false,
        stage: "compile",
        error: stderr.trim() || "退出码 " + code,
      });
    }
    // 编译成功，调用原 Runner / Debugger
    try {
      RunnerModule(res, pathName, fileName);
    } catch (e) {
      res.status(200).send({ success: false, stage: "run", error: e.message });
    }
  });
};
