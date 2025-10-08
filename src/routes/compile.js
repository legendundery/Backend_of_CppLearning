const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const router = express.Router();

// 最小：仍使用 /api/compile/cpp 路径（保持前端不用改）
router.post("/api/compile/cpp", (req, res) => {
  const code = (req.body && req.body.code) || "";
  const input = (req.body && req.body.input) || "";
  if (!code) {
    // 也返回 200，避免前端 catch
    return res.json({ success: false, code: "BAD_REQUEST", error: "缺少代码" });
  }

  const workDir = path.join(__dirname, "../../public/Code");
  fs.mkdirSync(workDir, { recursive: true });

  const src = path.join(workDir, "main.cpp");
  const bin = path.join(workDir, "main.out");

  try {
    fs.writeFileSync(src, code, "utf8");
  } catch (e) {
    // 真正内部错误仍 500
    return res
      .status(500)
      .json({ success: false, code: "WRITE_FAIL", error: e.message });
  }

  const CXX = process.env.CXX_PATH || "g++";
  const compileArgs = ["-std=c++17", "main.cpp", "-O2", "-o", "main.out"];

  let compileErr = "";
  const cp = spawn(CXX, compileArgs, { cwd: workDir });

  cp.stderr.on("data", (d) => (compileErr += d.toString()));
  cp.on("error", (err) => {
    // 预期型（没装编译器）也返回 200
    if (err.code === "ENOENT") {
      return res.json({
        success: false,
        code: "NO_COMPILER",
        error: "找不到 g++ (安装 build-essential 或设 CXX_PATH)",
      });
    }
    return res.json({
      success: false,
      code: "SPAWN_ERROR",
      error: err.message,
    });
  });

  cp.on("close", (codeExit) => {
    if (codeExit !== 0) {
      return res.json({
        success: false,
        code: "COMPILE_FAIL",
        error: (compileErr || "编译失败").trim(),
        stderr: compileErr.trim(),
      });
    }

    // 运行阶段
    let runOut = "";
    let runErr = "";
    let runTimedOut = false;

    const run = spawn(bin, [], { cwd: workDir });
    const timer = setTimeout(() => {
      runTimedOut = true;
      run.kill("SIGKILL");
    }, 3000); // 3s 运行超时

    run.stdout.on("data", (d) => (runOut += d.toString()));
    run.stderr.on("data", (d) => (runErr += d.toString()));
    run.on("error", (e) => {
      clearTimeout(timer);
      return res.json({
        success: false,
        code: "RUN_ERROR",
        error: e.message,
      });
    });
    run.on("close", (rc) => {
      clearTimeout(timer);
      if (runTimedOut) {
        return res.json({
          success: false,
          code: "RUN_TIMEOUT",
          error: "运行超时(>3s)",
          stderr: runErr,
        });
      }
      return res.json({
        success: true,
        code: "OK",
        output: runOut, // 前端读取
        stdout: runOut, // 兼容
        runStdout: runOut, // 兼容
        stderr: runErr,
        runStderr: runErr,
        compileStderr: compileErr.trim(),
        exitCode: rc,
      });
    });

    if (input) {
      run.stdin.write(input.endsWith("\n") ? input : input + "\n");
    }
    run.stdin.end();
  });
});

// 原调试接口保持占位（可不动）
router.post("/api/debug/cpp", (req, res) => {
  const code = (req.body && req.body.code) || "";
  const input = (req.body && req.body.input) || "";
  if (!code) {
    return res.json({ success: false, code: "BAD_REQUEST", error: "缺少代码" });
  }

  // 轻量“可视化/调试”实现：
  // 1. 静态解析：函数/包含的头文件/行数/注释行/空行
  // 2. 可选编译运行（与 compile 逻辑相同）
  // 3. 返回 debug:{ metrics, functions, includes }

  const lines = code.split(/\r?\n/);
  const totalLines = lines.length;
  let blankLines = 0;
  let commentLines = 0;
  const includeSet = new Set();
  const functionList = [];
  const funcRegex =
    /^(?:\s*(?:inline|static|virtual|constexpr|friend)\s+)*[A-Za-z_][A-Za-z0-9_:\<>\*&\s]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*\)\s*(?:const)?\s*(?:\{|$)/;
  const includeRegex = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/;
  let insideBlockComment = false;

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      blankLines++;
      return;
    }
    // 粗略处理块注释
    if (insideBlockComment) {
      commentLines++;
      if (line.includes("*/")) insideBlockComment = false;
      return;
    }
    if (line.startsWith("//")) {
      commentLines++;
      return;
    }
    if (line.startsWith("/*")) {
      commentLines++;
      if (!line.includes("*/")) insideBlockComment = true;
      return;
    }
    const inc = line.match(includeRegex);
    if (inc) includeSet.add(inc[1]);
    const fm = line.match(funcRegex);
    if (fm) {
      functionList.push({ name: fm[1], line: idx + 1 });
    }
  });

  const metrics = {
    totalLines,
    blankLines,
    commentLines,
    codeLines: totalLines - blankLines - commentLines,
  };
  const includes = Array.from(includeSet);

  // 复用编译运行（可选）——为保持一致性，仍然尝试编译执行并附加输出
  const workDir = path.join(__dirname, "../../public/Code");
  fs.mkdirSync(workDir, { recursive: true });
  const src = path.join(workDir, "main.cpp");
  const bin = path.join(workDir, "main_dbg.out");
  try {
    fs.writeFileSync(src, code, "utf8");
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, code: "WRITE_FAIL", error: e.message });
  }
  const CXX = process.env.CXX_PATH || "g++";
  const compileArgs = [
    "-std=c++17",
    "main.cpp",
    "-O0",
    "-g",
    "-o",
    "main_dbg.out",
  ]; // 带调试符号
  let compileErr = "";
  const cp = spawn(CXX, compileArgs, { cwd: workDir });
  cp.stderr.on("data", (d) => (compileErr += d.toString()));
  cp.on("error", (err) => {
    return res.json({
      success: false,
      code: err.code === "ENOENT" ? "NO_COMPILER" : "SPAWN_ERROR",
      error: err.message,
      debug: { metrics, functions: functionList, includes },
    });
  });
  cp.on("close", (c) => {
    if (c !== 0) {
      return res.json({
        success: false,
        code: "COMPILE_FAIL",
        error: (compileErr || "编译失败").trim(),
        stderr: compileErr.trim(),
        debug: { metrics, functions: functionList, includes },
      });
    }
    // 运行
    let runOut = "";
    let runErr = "";
    let runTimedOut = false;
    const run = spawn(bin, [], { cwd: workDir });
    const timer = setTimeout(() => {
      runTimedOut = true;
      run.kill("SIGKILL");
    }, 3000);
    run.stdout.on("data", (d) => (runOut += d.toString()));
    run.stderr.on("data", (d) => (runErr += d.toString()));
    run.on("error", (e) => {
      clearTimeout(timer);
      return res.json({
        success: false,
        code: "RUN_ERROR",
        error: e.message,
        debug: { metrics, functions: functionList, includes },
      });
    });
    run.on("close", (rc) => {
      clearTimeout(timer);
      if (runTimedOut) {
        return res.json({
          success: false,
          code: "RUN_TIMEOUT",
          error: "运行超时(>3s)",
          debug: { metrics, functions: functionList, includes },
        });
      }
      return res.json({
        success: true,
        code: "OK",
        output: runOut,
        stdout: runOut,
        stderr: runErr,
        exitCode: rc,
        compileStderr: compileErr.trim(),
        debug: { metrics, functions: functionList, includes },
      });
    });
    if (input) {
      run.stdin.write(input.endsWith("\n") ? input : input + "\n");
    }
    run.stdin.end();
  });
});

module.exports = router;
