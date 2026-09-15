# 阶段 0 交接记录

更新日期：2026-09-10

## 已完成并验证

- FastAPI 使用真实账号、Argon2 密码哈希、JWT Access Token 和可撤销 Refresh Session。
- 个人练习记录按当前登录用户鉴权，公共课程接口不泄露个人进度。
- Alembic 已建立 `0001` 基线并升级到 `0002_auth_and_sessions`。
- 本地 PostgreSQL 17 容器运行于 `127.0.0.1:5433`，健康检查通过。
- SQLite 数据已复制到 PostgreSQL：2 个用户、2 个单元、24 个句子。
- `scripts/migrate_sqlite_to_postgres.py` 保留源库、拒绝覆盖非空目标库，并有自动化测试。
- 主后端已切换到 PostgreSQL；`/ready` 返回数据库类型和迁移版本。
- 阿里云 NLS 支持 RAM AccessKey 自动刷新 Token，并兼容手工 Token。
- 请求日志包含 Request ID、耗时和状态码，不记录密码、Token、请求体或查询参数。
- Sentry 为可选接入，默认关闭个人信息与性能采样。
- CI 执行 Alembic、后端测试、TypeScript 检查和 Expo Web 导出。

## 本地运行状态

- Web：`http://localhost:8083`
- API：`http://localhost:8000`
- API 文档：`http://localhost:8000/docs`
- 就绪检查：`http://localhost:8000/ready`
- PostgreSQL：`127.0.0.1:5433`

## npm 安全告警判断

`npm audit` 当前报告 14 个中等级告警、0 个高危、0 个严重告警。它们来自 Expo CLI、Expo Router、Xcode 配置工具等传递依赖。npm 给出的自动方案会将 Expo 57 降级到 Expo 46，或执行不兼容的主版本变更，因此本阶段不执行 `npm audit fix --force`。后续跟随 Expo 57 的官方兼容版本更新统一处理。

## 生产部署前需要外部配置

- 托管 PostgreSQL 地址、备份和恢复策略。
- 随机生成并安全托管的 `JWT_SECRET_KEY`。
- 阿里云最小权限 RAM AccessKey。
- Sentry 项目 DSN 和告警接收人。
- HTTPS 域名和生产 CORS 白名单。

这些配置依赖最终云账号和部署环境，不应写入仓库。
