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

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) return res.sendStatus(403);
    next();
  };
};

module.exports = { authenticateToken, requireRole };
