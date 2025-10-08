const fs = require("fs");
const path = require("path");

function resolveCmd(envVar, fallback) {
  const v = process.env[envVar];
  if (v) {
    // 允许相对或绝对路径
    const abs = path.isAbsolute(v) ? v : path.resolve(v);
    if (fs.existsSync(abs)) return abs;
    // 也可能只给了命令名（在 PATH）
    return v;
  }
  return fallback;
}

module.exports = {
  CXX: resolveCmd("CXX_PATH", "g++"),
  GDB: resolveCmd("GDB_PATH", "gdb"),
};
