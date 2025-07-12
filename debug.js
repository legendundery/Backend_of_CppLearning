const child_process = require("child_process");
const fs = require("fs");

const path_name = "./public/Code/";
const file_name = "text";

const inputData = fs.readFileSync(
  path_name + file_name + "Input" + ".txt",
  "utf-8"
);

var output = child_process.spawn(path_name + file_name + ".exe", []);

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
});
