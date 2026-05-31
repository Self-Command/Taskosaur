# Taskosaur 服务器部署指南

## 环境要求

- **Docker** ≥ 24.0
- **Docker Compose** ≥ v2.20
- **内存** ≥ 2GB
- **磁盘** ≥ 10GB

## 第一步：克隆源码

```bash
git clone https://github.com/Self-Command/Taskosaur.git
cd Taskosaur
```

## 第二步：配置环境变量

```bash
cp .env.example .env
nano .env
```

**必须修改的变量：**

```env
# 安全密钥 — 用 openssl 生成
JWT_SECRET="$(openssl rand -base64 32)"
JWT_REFRESH_SECRET="$(openssl rand -base64 32)"
ENCRYPTION_KEY="$(openssl rand -hex 32)"

# 数据库密码
POSTGRES_PASSWORD="your-strong-password"

# 访问端口（默认 9700）
APP_PORT=9700

# 域名（如果有）
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api

# 邮件（可选）
SMTP_HOST=smtp.your-email.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@your-domain.com

# S3 存储（可选，默认本地存储）
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket
```

## 第三步：启动

```bash
docker compose up -d
```

Docker 会自动：
1. 拉取 PostgreSQL 16 和 Redis 7 镜像
2. 从源码构建 Taskosaur（前后端一起编译）
3. 运行数据库迁移
4. 启动服务

## 第四步：验证

```bash
curl http://localhost:9700/api
# 返回: Welcome to Taskosaur Backend API!
```

浏览器打开 `http://your-server-ip:9700`

## 管理命令

```bash
# 查看日志
docker compose logs -f app

# 重启
docker compose restart

# 更新代码
git pull
docker compose up -d --build

# 停止
docker compose down

# 备份数据库
docker compose exec postgres pg_dump -U taskosaur taskosaur > backup.sql
```

## 端口说明

| 端口 | 用途 | 对外暴露 |
|------|------|---------|
| 9700 | 应用（前端+后端） | ✅ |
| 5432 | PostgreSQL | ❌ 仅 Docker 内网 |
| 6379 | Redis | ❌ 仅 Docker 内网 |

## 数据持久化

数据存储在 Docker volumes 中，重启不会丢失：
- `postgres_data` — 数据库
- `redis_data` — 队列
- `app_uploads` — 上传文件

## 反向代理（可选）

使用 Nginx 反向代理并配置 HTTPS：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:9700;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
