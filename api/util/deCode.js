const typeToFunction = {
  int: "deCodeInt",
  short: "deCodeInt",
  long: "deCodeInt",
  "long long": "deCodeInt",
  "unsigned int": "deCode",
  "unsigned short": "deCode",
  "unsigned long": "deCode",
  "unsigned long long": "deCode",

  double: "deCodeDouble",
  float: "deCodeDouble",
  "long double": "deCodeDouble",

  char: "deCodeChar",

  bool: "deCodeBool",
};

function deCodeValue(type, value) {
  const funcName = typeToFunction[type];
  if (funcName && typeof this[funcName] === "function") {
    return this[funcName](value);
  } else {
    var tmp_match;
    const regexClass =
      /class [0-9a-zA-Z_]\w*\{\s*(public:\s*[\s\S]*?)?\s*(private:\s*[\s\S]*?)?\s*(protected:\s*[\s\S]*?)?\s*(public:\s*[\s\S]*?)?\s*(private:\s*[\s\S]*?)?\s*(protected:\s*[\s\S]*?)?\s*\}/;
    if ((tmp_match = regexClass.exec(type)) !== null) {
      return deCdoeClass(tmp_match);
    }

    return undefined;
  }
}

function deCodeInt(value) {
  return parseInt(value);
}
function deCodeDouble(value) {
  return parseFloat(value);
}
function deCodeChar(value) {
  const tmp_ch = value.match(/'(.)'/);
  if (tmp_ch) {
    return tmp_ch[1];
  } else {
    return undefined;
  }
}
function deCodeBool(value) {
  return value;
}

function deCdoeClass(classMatch) {
  return undefined;
}

module.exports = {
  deCodeValue,
  deCodeInt,
  deCodeDouble,
  deCodeChar,
  deCodeBool,
};
