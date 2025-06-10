const child_process = require("child_process");
const fs = require("fs");

const CodeRunner = (res, path_name, file_name) => {
  //input = input.split(' ').filter(item => item != '');
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
    const jsondata = {
      output: outputdata,
    };
    res.send(jsondata);
  });
};

module.exports = CodeRunner;
