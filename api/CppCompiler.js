const child_process = require("child_process");

const CppCompiler = (res, path_name, file_name, callback) => {
  var gcc = child_process.spawn("./mingw64/bin/g++", [
    "-g",
    path_name + file_name + ".cpp",
    "-o",
    path_name + file_name + ".exe",
  ]);
  gcc.stderr.on("data", (data) => {
    console.log("Compile error:" + data.toString());
  });
  gcc.stdout.on("data", (data) => {
    console.log("Compile result:" + data.toString());
  });
  gcc.on("close", () => {
    console.log("compile success");
    callback(res, path_name, file_name);
  });
};

module.exports = CppCompiler;
