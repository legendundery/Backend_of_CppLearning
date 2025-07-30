const mysql = require("mysql2");
require("dotenv").config();

// 创建连接池（推荐生产环境使用）
const pool = mysql.createPool({
  host: process.env.DB_HOST, // 数据库服务器地址
  user: process.env.DB_USER, // 数据库用户名
  password: process.env.DB_PASSWORD, // 数据库密码
  database: process.env.DB_NAME, // 要连接的数据库名称
  waitForConnections: true,
  connectionLimit: 10, // 连接池最大连接数
  queueLimit: 0,
});

// 获取一个 Promise 版本的连接
const promisePool = pool.promise();

module.exports = promisePool;
