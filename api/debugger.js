const child_process = require("child_process");

const CodeDebugger = (res, path_name, file_name) => {
  const deCode = require(__dirname + "./util/deCode");

  var input = "";

  var flag = false;

  var state = "continue";
  var length_func = 0;
  var index_func = 0;
  var index_value = 0;

  //steps = [{functions1, line_number}, ...]
  var functions = [];
  //functions = [{function_name, values}, ...]
  var variable = [];

  var jsonData = {
    output: "",
    steps: [],
  };
  var jsonLength = 0;

  var gdb = child_process.spawn("gdb", [path_name + file_name + ".exe"]);
  gdb.stdout.on("data", (data) => {
    const str = data.toString();
    console.log("!:" + data);

    if (!flag) {
      if (/^\(gdb\)/.test(str)) {
        gdb.stdin.write("break main\n");
        gdb.stdin.write(
          "run < " +
            path_name +
            file_name +
            "Input" +
            ".txt" +
            " > " +
            path_name +
            file_name +
            "Output" +
            ".txt" +
            "\n"
        );
        flag = true;
        return;
      }
    }

    if (/\(gdb\)/gm.test(str)) {
      input = input + str;

      input = input.replace(/^\(gdb\) $/gm, "").slice(0, -1);

      const quitRegex1 = /[0-9]+\s*in\s*\S*?(\w*)\.(\w*)/gm;
      if (quitRegex1.test(input)) {
        input = "";
        gdb.stdin.write("s\n");

        return;
      }

      const quitRegex2 = /\[Thread \w*.\w* exited with code [0-9]\]/gm;
      if (quitRegex2.test(input)) {
        input = "";
        gdb.stdin.write("quit\n");

        return;
      }
      const quitRegex3 = /No symbol table info available./gm;
      if (quitRegex3.test(input)) {
        input = "";
        gdb.stdin.write("s\n");

        return;
      }

      //函数入
      var tmpFuncName =
        /\w*\s*\([\S\s]*?\)\s*at\s*\S*?(\w*)\.(\w*)\:[0-9]+/gm.exec(input);
      //console.log(input);
      console.log(tmpFuncName);
      if (tmpFuncName) {
        if (tmpFuncName[1] !== file_name) {
          //console.log("!");
          //console.log(tmpFuncName[0].split(" ")[0]);
          input = "";
          gdb.stdin.write("n\n");

          return;
        }
      }

      //console.log("input:" + input);
      var tmpNum = input.match(/^[0-9]/gm);
      if (tmpNum) {
        //console.log("input:" + input);

        //console.log("\nline number:" + tmpNum);

        //console.log(variable);
        //console.log("\n");
        if (functions.length) {
          jsonLength++;

          jsonData.steps.push({
            functions: functions,
            line_number: tmpNum[0],
            key: jsonLength,
          });
        }

        input = "";
        state = "value_name";

        functions = [];
        variable = [];

        gdb.stdin.write("bt full\n");
        return;
      }

      if (state === "value_name") {
        //console.log(input);
        const regexFunctionName =
          /#[0-9]+(?:[\s\S]*?)(\w*) \([\s\S]*?\) at \S*([\s\S]*?)(?=#|$)/g;
        //          /\#[0-9]+(?:.*?)?\s+(\w*)\s+\([\s\S]*\)\s*at\s*\S*?\w*\.\w*\:[0-9]+((?:[\s\S]*?)(?=\s*\#[0-9]+\s*|$))/g;
        const regex =
          /\s*([a-zA-Z_]\w*)\s+=\s+((?:[\s\S]*?)(?=\s*#[0-9]+\s*|\s*[a-zA-Z_]\w*\s*=\s*|$))/g;

        var tmpFuncMatch;
        while ((tmpFuncMatch = regexFunctionName.exec(input)) !== null) {
          //console.log(tmpFuncMatch);
          var tmp_match;
          while ((tmp_match = regex.exec(tmpFuncMatch[2])) !== null) {
            //console.log("tmp:" + tmp_match);
            variable.push({
              name: tmp_match[1],
              value: tmp_match[2].trim(),
            });
          }
          if (variable) {
            functions.push({
              function_name: tmpFuncMatch[1],
              values: variable,
            });
          }

          variable = [];
        }

        if (!functions) {
          input = "";
          gdb.stdin.write("s\n");
          return;
        }

        //console.log("name:" + variable_name);
        //console.log("value:" + variable_value);

        state = "value_type";
        length_func = functions.length;
        length_value = functions[0].values.length;
        index_func = 0;
        index_value = 0;

        while (index_value >= functions[index_func].values.length) {
          index_value = 0;
          index_func++;
          if (index_func >= length_func) break;
        }

        if (index_func < length_func) {
          gdb.stdin.write(
            "ptype " +
              functions[index_func].function_name +
              "::" +
              functions[index_func].values[index_value].name +
              "\n"
          );
        } else {
          gdb.stdin.write("s\n");
        }

        //console.log("length:" + length);
      } else if (state === "value_type") {
        const regex = /type\s*=\s*((?:[\s\S]*?)(?=\ntype\s*=\s*|$))/g;

        var tmp_match;
        if ((tmp_match = regex.exec(input)) !== null) {
          //console.log("tmp:" + tmp_match);
          const current_value = functions[index_func].values[index_value];
          current_value.type = tmp_match[1].trim();
          current_value.value = deCode.deCodeValue(
            current_value.type,
            current_value.value
          );
        }

        index_value++;

        while (index_value >= functions[index_func].values.length) {
          index_value = 0;
          index_func = index_func + 1;
          if (index_func >= length_func) break;
        }

        if (index_func < length_func) {
          gdb.stdin.write(
            "ptype " +
              functions[index_func].function_name +
              "::" +
              functions[index_func].values[index_value].name +
              "\n"
          );
        } else {
          state = "value_address";

          index_func = 0;
          index_value = 0;

          while (index_value >= functions[index_func].values.length) {
            index_value = 0;
            index_func++;
            if (index_func >= length_func) break;
          }

          if (index_func < length_func) {
            gdb.stdin.write(
              "print &" +
                functions[index_func].function_name +
                "::" +
                functions[index_func].values[index_value].name +
                "\n"
            );
          } else {
            gdb.stdin.write("s\n");
          }
        }
      } else if (state === "value_address") {
        const regex = /\$[0-9]+\s*=\s*(?:\(.*\))? (0x.*)/;

        var tmp_match;
        if ((tmp_match = regex.exec(input)) !== null) {
          //console.log("tmp:" + tmp_match);
          functions[index_func].values[index_value].address = tmp_match[1]
            .trim()
            .split(" ")[0];
        }

        index_value++;

        while (index_value >= functions[index_func].values.length) {
          index_value = 0;
          index_func = index_func + 1;
          if (index_func >= length_func) break;
        }

        if (index_func < length_func) {
          gdb.stdin.write(
            "print " +
              "&" +
              functions[index_func].function_name +
              "::" +
              functions[index_func].values[index_value].name +
              "\n"
          );
        } else {
          state = "value_name";
          gdb.stdin.write("s\n");
        }
      }

      input = "";
    } else {
      //缓冲
      //console.log("raw:" + str);
      input = input + str;
    }
  });

  gdb.on("close", (code) => {
    console.log(code);
    //    res.send(jsonData);

    const fs = require("fs");
    fs.readFile(
      path_name + file_name + "Output" + ".txt",
      "utf-8",
      (err, data) => {
        if (err) {
          console.log("Output File Failed");
          return;
        }
        jsonData.output = data;
        console.log(jsonData);
        res.send(jsonData);
      }
    );
  });
};

module.exports = CodeDebugger;
