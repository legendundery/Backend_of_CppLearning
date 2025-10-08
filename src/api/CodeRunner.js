const { spawn } = require("child_process");
const { CXX } = require("./util/toolPath");
const fs = require("fs");

/**
 * 运行阶段
 * 成功: { success:true, output }
 * 失败: { success:false, stage:'run', error, output(可能部分), code }
 */
const CodeRunner = (res, path_name, file_name) => {
  let stdoutBuf = "";
  let stderrBuf = "";
  let exited = false;
  let proc;
  try {
    proc = spawn(CXX, [path_name + file_name + ".exe"]);
  } catch (err) {
    return res.status(200).send({
      success: false,
      stage: "run",
      error: err.message || String(err),
      output: "",
    });
  }

  try {
    const inputData = fs.readFileSync(
      path_name + file_name + "Input" + ".txt",
      "utf-8"
    );
    proc.stdin.write(inputData);
    proc.stdin.end();
  } catch (e) {
    // 输入文件读取失败也当作运行失败
    return res.status(200).send({
      success: false,
      stage: "run",
      error: "read input failed: " + (e.message || e),
      output: "",
    });
  }

  proc.stderr.on("data", (d) => {
    const t = d.toString();
    stderrBuf += t;
    console.log("[Run][stderr]" + t);
  });
  proc.stdout.on("data", (d) => {
    const t = d.toString();
    stdoutBuf += t;
    console.log("[Run][stdout]" + t);
  });
  proc.on("error", (err) => {
    if (exited) return;
    exited = true;
    res.status(200).send({
      success: false,
      stage: "run",
      error: err.message || String(err),
      output: stdoutBuf,
    });
  });
  proc.on("close", (code) => {
    if (exited) return;
    exited = true;
    if (code !== 0 || stderrBuf.trim()) {
      return res.status(200).send({
        success: false,
        stage: "run",
        error: stderrBuf || `process exited with code ${code}`,
        output: stdoutBuf,
        code,
      });
    }
    res.status(200).send({ success: true, output: stdoutBuf || "" });
  });
};

module.exports = CodeRunner;
