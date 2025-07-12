const express = require("express");
const cors = require("cors");

const path = require("path");

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static("public"));

const router = require("./routes/index.js");

app.use("/", router);

app.listen(3000, () => {
  console.log("start serve");
});
