const express = require("express");
const cors = require("cors");

const path = require("path");

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static("public"));
app.use(express.static("dist"));

const router = require("./src/routes/index.js");

app.use("/", router);

app.listen(1437, () => {
  console.log("http://localhost:1437");
});
