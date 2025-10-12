## 后端 (Backend_of_CppLearning) – Express + MySQL

### 技术栈

Express.js + mysql2 (Promise Pool) + dotenv + jsonwebtoken + bcryptjs + CORS。
（注：如需启用上传/转码，可接入 multer/ffmpeg，当前仓库以编译/调试与课程基础接口为主。）

### 主要目录

```
Backend_of_CppLearning/
  index.js              # 入口，加载路由/CORS/静态
  .env                  # 环境变量（勿提交生产机机密版本）
  src/
    config.js           # 端口 / baseUrl / 上传目录 / 数据库配置
    db/
      db.js             # mysql2 连接池
      users.js          # 用户相关 SQL 方法
    routes/
      index.js          # 总路由聚合
      courses/public.js # 课程 & 课时（如启用上传再扩展）
      users/public.js   # 登录/注册（如需启用需挂载）
      compile.js        # C++ 编译/运行、静态调试
    middleware/
      upload.js         # (假设存在) 视频/封面上传策略
  uploads/
    images/             # 封面
    videos/             # 课时视频
```

### 环境变量 (.env 示例)

```
PORT=1437
BASE_URL=http://localhost:1437
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=koishi
JWT_SECRET=your_jwt_secret
FRONTEND_ORIGINS=http://localhost:5174,http://localhost:8849
# 可选：指定 g++ 路径（不设置则使用系统 PATH）
# CXX_PATH=/usr/bin/g++
# 运行超时（毫秒）
RUN_TIMEOUT_MS=3000
MAX_VIDEO_SIZE_MB=500
MAX_IMAGE_SIZE_MB=5
UPLOAD_DIR=./uploads
VIDEO_UPLOAD_DIR=./uploads/videos
IMAGE_UPLOAD_DIR=./uploads/images
```

> 生产环境请使用与数据库匹配的真实账号，并将 `.env` 限制在服务器权限内。

### 数据库初始化

1. 创建数据库：
   ```sql
   CREATE DATABASE koishi DEFAULT CHARACTER SET utf8mb4;
   ```
2. 建表顺序（确保 users → courses → lessons → triggers）：
   - `mysql/createusers.txt`
   - `mysql/createcourses.txt`
   - `mysql/createlessons.txt`
   - `mysql/createtrigger.txt` （如果有统计/更新触发器）
3. 可选添加测试数据：
   ```sql
   INSERT INTO users (username,email,role,password_hash) VALUES ('admin','a@a.com','admin','$2a$10$...');
   INSERT INTO courses (title,description,instructor_id,status) VALUES ('测试课程','描述',1,'published');
   ```

### 安装依赖

```
pnpm install
```

### 开发启动

```
pnpm dev  # 使用 nodemon 自动重载
```

访问 `http://localhost:1437`，接口前缀 `/api`。

### 生产启动

```
pnpm install --prod
node index.js
# 或使用 pm2：
pm2 start index.js --name webide-backend
pm2 save
```

### API 约定（公开部分）

| 方法   | 路径                     | 描述                                      |
| ------ | ------------------------ | ----------------------------------------- |
| POST   | /api/compile/cpp         | 编译并运行 C++（统一超时/错误返回结构）   |
| POST   | /api/debug/cpp           | 静态度量（行数/函数/包含）+ 运行输出      |
| GET    | /api/users/profile       | 用户基本信息 + 统计占位（安全降级）      |
| GET    | /api/courses             | 课程列表（如启用课程模块）                |
| GET    | /api/courses/:id         | 单课程详情（如启用课程模块）              |
| GET    | /api/courses/lessons/:id | 课程下课时列表（如启用课程模块）          |
| POST   | /api/courses             | 创建课程（如启用上传）                    |
| POST   | /api/courses/lesson      | 创建课时（如启用上传）                    |
| DELETE | /api/courses/:id         | 逻辑隐藏课程                              |

用户（如果挂载 users.public）：
| POST /api/users/register | 注册 |
| POST /api/users/login | 登录，返回 token |

> 登录后建议前端在请求头加 `Authorization: Bearer <token>`，并在后续扩展受保护接口时加入鉴权中间件。
> 说明：刷新 token 接口（/auth/refresh）在当前仓库未提供，如前端含占位逻辑，请关闭或改为静默重登。

### 课程/视频上传说明

- 封面图：表单字段名与 `coverUpload` 中间件保持一致（例如 `cover`）。
- 课时视频：字段名与 `videoUpload` 保持一致（例如 `video_file`）。
- 成功后响应 JSON 包含 `cover_url` / `video_url`。

### CORS 策略

在 `index.js` 中维护白名单：本地 `5174` / `8849`，或使用环境变量 `FRONTEND_ORIGINS` 逗号分隔配置多个来源。
若生产只需一个前端域，可精简为：

```js
origin: "https://your.frontend.domain";
```

### Nginx 反向代理（与前端配合）

```
server {
  listen 8849;
  server_name your.domain;
  root /var/www/webide-frontend/dist;

  location /api/ {
    proxy_pass http://127.0.0.1:1437/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  try_files $uri /index.html;
}
```

### 健康检查（可选添加）

在 `routes/index.js` 中：

```js
router.get("/api/healthz", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});
```

### 生产打包/发布参考

后端本身是 Node 服务，不需要“前端式打包”，只需：

```
# 复制必要文件到部署目录
rsync -av --exclude node_modules --exclude .git Backend_of_CppLearning/ /srv/webide-backend
cd /srv/webide-backend
pnpm install --prod
pm2 start index.js --name webide-backend
```

可选压缩归档：

```
cd Backend_of_CppLearning
zip -r backend-release.zip index.js src package.json pnpm-lock.yaml .env.example
```

### 日志与监控建议

- pm2 logs / pm2 monit
- 为上传/转码错误添加更多 try/catch 日志
- 结合 Nginx access.log 做请求级监控

### 安全建议 & TODO

- 对上传做 MIME/大小/扩展名双重校验
- 给受保护接口加 JWT 验证中间件
- 限制课程/课时创建接口仅管理员角色使用
- 考虑将静态文件前缀改为 `/static` 与 API 区分
- 数据库账号最小权限原则（只授权必要库）

### 常见问题排查

| 现象                          | 可能原因                              | 处理                                          |
| ----------------------------- | ------------------------------------- | --------------------------------------------- |
| 调用 /api/compile/cpp 报 ENOENT | 服务器未安装 g++ 或 PATH 不含 g++     | 安装系统 g++（Linux: build-essential），或设置 CXX_PATH |
| 运行无响应或超时              | 用户代码阻塞 / 死循环                 | 调整 RUN_TIMEOUT_MS，提示用户优化代码         |
| CORS 报错                     | 域不在白名单                          | 设置 FRONTEND_ORIGINS 或固定 origin            |
| /api/courses 超时             | MySQL 未启动 / 连接参数错             | 检查 .env / 数据库连接                         |
| Token 刷新 404                | 后端未提供 /auth/refresh              | 前端关闭自动刷新或改为静默重登                 |

### 与前端协同

前端通过 `/api` 代理，无需写死域名；生产与开发保持统一路径结构，避免环境分支逻辑。

---

依赖说明：
- Windows 目录内包含 `mingw64/`（仅用于本地调试）；Linux/服务器部署请优先使用系统 g++。

前端部署与构建说明见 `vide/README.md`。
