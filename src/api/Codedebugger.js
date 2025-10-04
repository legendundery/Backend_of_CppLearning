const child_process = require("child_process");
const fs = require("fs");

/**
 * 调试：先 gdb 采集，再执行程序
 * 成功: { success:true, output, debug: gdb_data }
 * 失败: { success:false, stage:'debug'|'run', error, output? }
 */
const CodeDebugger = (res, path_name, file_name) => {
  let gdb_raw_data = "";
  let gdbErr = "";
  let gdbExited = false;
  let gdbProcess;
  try {
    gdbProcess = child_process.spawn("./mingw64/bin/gdb", [
      "--silent",
      "--batch",
      "-x",
      "./src/api/gdb_py.py",
      path_name + file_name + ".exe",
    ]);
  } catch (err) {
    return res
      .status(200)
      .send({
        success: false,
        stage: "debug",
        error: err.message || String(err),
      });
  }

  gdbProcess.stdout.on("data", (data) => {
    const t = data.toString();
    gdb_raw_data += t;
    console.log("[GDB][stdout]" + t);
  });
  gdbProcess.stderr.on("data", (data) => {
    const t = data.toString();
    gdbErr += t;
    console.log("[GDB][stderr]" + t);
  });
  gdbProcess.on("error", (err) => {
    if (gdbExited) return;
    gdbExited = true;
    res
      .status(200)
      .send({
        success: false,
        stage: "debug",
        error: err.message || String(err),
      });
  });
  gdbProcess.on("close", (code) => {
    if (gdbExited) return;
    gdbExited = true;
    if (code !== 0 || gdbErr.trim()) {
      return res
        .status(200)
        .send({
          success: false,
          stage: "debug",
          error: gdbErr || `gdb exited with code ${code}`,
        });
    }
    let gdbDataObj = {};
    try {
      const match = /<gdb_debug_complete>\s*([\s\S]*)/.exec(gdb_raw_data);
      if (match && match[1]) {
        gdbDataObj = JSON.parse(match[1]);
      } else {
        gdbDataObj = { raw: gdb_raw_data };
      }
    } catch (e) {
      return res
        .status(200)
        .send({
          success: false,
          stage: "debug",
          error: "parse gdb json failed: " + (e.message || e),
        });
    }

    // 运行阶段
    let runStdout = "";
    let runStderr = "";
    let runExited = false;
    let runProc;
    try {
      runProc = child_process.spawn(path_name + file_name + ".exe", []);
    } catch (err) {
      return res
        .status(200)
        .send({
          success: false,
          stage: "run",
          error: err.message || String(err),
        });
    }
    try {
      const inputData = fs.readFileSync(
        path_name + file_name + "Input" + ".txt",
        "utf-8"
      );
      runProc.stdin.write(inputData);
      runProc.stdin.end();
    } catch (e) {
      return res
        .status(200)
        .send({
          success: false,
          stage: "run",
          error: "read input failed: " + (e.message || e),
        });
    }
    runProc.stderr.on("data", (d) => {
      const t = d.toString();
      runStderr += t;
      console.log("[Run][stderr]" + t);
    });
    runProc.stdout.on("data", (d) => {
      const t = d.toString();
      runStdout += t;
      console.log("[Run][stdout]" + t);
    });
    runProc.on("error", (err) => {
      if (runExited) return;
      runExited = true;
      res
        .status(200)
        .send({
          success: false,
          stage: "run",
          error: err.message || String(err),
          output: runStdout,
        });
    });
    runProc.on("close", (c) => {
      if (runExited) return;
      runExited = true;
      if (c !== 0 || runStderr.trim()) {
        return res
          .status(200)
          .send({
            success: false,
            stage: "run",
            error: runStderr || `process exited with code ${c}`,
            output: runStdout,
            debug: gdbDataObj,
          });
      }
      res
        .status(200)
        .send({ success: true, output: runStdout || "", debug: gdbDataObj });
    });
  });
};

module.exports = CodeDebugger;
