const jwt = require("jsonwebtoken");
require("dotenv").config();

// JWT验证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, info) => {
    if (err) {
      return res.sendStatus(403);
    }

    req.user = info.user;
    next();
  });
}

// 可选鉴权：有 token 就解析，没有就继续（用于游客可访问页面）
function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return next();
  jwt.verify(token, process.env.JWT_SECRET, (err, info) => {
    if (!err) {
      req.user = info.user;
    }
    // 无论成败都放行，错误情况下视为游客
    next();
  });
}

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) return res.sendStatus(403);
    next();
  };
};

// 多角色允许
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.sendStatus(403);
    next();
  };
};

module.exports = { authenticateToken, optionalAuth, requireRole, allowRoles };
