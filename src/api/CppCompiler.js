const child_process = require("child_process");

/**
 * 编译 C++
 * 成功: 继续执行 callback (运行或调试)
 * 失败: 返回 { success:false, stage:'compile', error: stderr }
 */
const CppCompiler = (res, path_name, file_name, callback) => {
  let stderrBuf = "";
  let stdoutBuf = "";
  let exited = false;
  const gcc = child_process.spawn("./mingw64/bin/g++", [
    "-g",
    path_name + file_name + ".cpp",
    "-o",
    path_name + file_name + ".exe",
  ]);

  gcc.stderr.on("data", (data) => {
    const txt = data.toString();
    stderrBuf += txt;
    console.error("[Compile][stderr]" + txt);
  });
  gcc.stdout.on("data", (data) => {
    const txt = data.toString();
    stdoutBuf += txt;
    console.log("[Compile][stdout]" + txt);
  });
  gcc.on("error", (err) => {
    if (exited) return;
    exited = true;
    res
      .status(200)
      .send({
        success: false,
        stage: "compile",
        error: err.message || String(err),
      });
  });
  gcc.on("close", (code) => {
    if (exited) return;
    exited = true;
    if (code !== 0 || stderrBuf.trim()) {
      return res.status(200).send({
        success: false,
        stage: "compile",
        error: stderrBuf || `g++ exited with code ${code}`,
        output: "",
      });
    }
    console.log("[Compile] success");
    callback(res, path_name, file_name);
  });
};

module.exports = CppCompiler;
