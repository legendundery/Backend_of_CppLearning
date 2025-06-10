const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static("public"));
app.use(express.static("api"));
app.use(express.static("public/uploads"));

const router = require("./routes/index.js");

app.use("/", router);

app.listen(1437, () => {
  console.log("http://localhost:1437");
});
