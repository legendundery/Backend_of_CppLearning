const child_process = require("child_process");
const fs = require("fs");

const CodeDebugger = (res, path_name, file_name) => {
  var gdb_raw_data = "";

  const pythonProcess = child_process.spawn("gdb", [
    "--silent",
    "--batch",
    "-x",
    __dirname + "./gdb_py.py",
    path_name + file_name + ".exe",
  ]);
  pythonProcess.stdout.on("data", (data) => {
    console.log("data:", data.toString());
    gdb_raw_data = gdb_raw_data + data.toString();
  });

  pythonProcess.stderr.on("data", (err) => {
    console.log("err:", err.toString());
  });

  pythonProcess.on("close", (code) => {
    console.log("code: " + code);

    const child_process = require("child_process");
    var output = child_process.spawn(path_name + file_name + ".exe", []);

    const inputData = fs.readFileSync(
      path_name + file_name + "Input" + ".txt",
      "utf-8"
    );
    output.stdin.write(inputData);
    output.stdin.end();

    var outputdata = "";
    output.stderr.on("data", function (data) {
      console.log("run error:" + data.toString());
    });
    output.stdout.on("data", function (data) {
      console.log("run output:" + data.toString());
      outputdata = outputdata + data.toString();
      console.log("output data:" + outputdata);
    });
    output.on("close", (code) => {
      console.log(code);
      const gdb_string = /<gdb_debug_complete>\s*([\s\S]*)/.exec(
        gdb_raw_data
      )[1];

      //console.log(gdb_string);

      const gdb_data = JSON.parse(gdb_string);
      gdb_data["output"] = outputdata;

      //console.log(gdb_data);
      res.send(gdb_data);
    });
  });
};

module.exports = CodeDebugger;
