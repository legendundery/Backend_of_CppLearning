// 尝试修复 multipart 上传中文文件名在 Windows/Chrome 下出现的 "Ã" 等乱码问题
// 产生原因：Content-Disposition 里的 filename= 按字节为 UTF-8，而 busboy(multer底层) 按 latin1 直接解码
// 方案：检测可疑高位拉丁字符且缺少常见 CJK 后，按 latin1 -> utf8 重新转码

function needsRedecode(name) {
  if (!name) return false;
  // 包含拉丁扩展 (0xC0-0xFF) 且不包含任何 CJK 统一汉字，判定为疑似
  const hasLatinHigh = /[\u00C0-\u00FF]/.test(name);
  const hasCJK = /[\u3400-\u9FFF]/.test(name);
  if (hasLatinHigh && !hasCJK) return true;
  // 另一个特征：出现常见 mojibake 片段，如 "Ã" "�"
  if (/Ã|�/.test(name)) return true;
  return false;
}

function decodeOriginalName(name) {
  try {
    if (!needsRedecode(name)) return name;
    const recoded = Buffer.from(name, "latin1").toString("utf8");
    // 如果 recoded 中出现中文 或 比原字符串更长的多字节合理内容则采用
    const hasCJK = /[\u3400-\u9FFF]/.test(recoded);
    if (hasCJK) return recoded;
    // 若未出现中文但原字符串显然是乱码，仍返回 recoded
    return recoded;
  } catch (e) {
    return name; // 回退
  }
}

module.exports = { decodeOriginalName };
