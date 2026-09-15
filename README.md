# EN-teach · Lumi 英语学习应用

面向小学生的卡通化英语学习应用。Lumi 作为学习伙伴在课程中进行引导，学生通过单词、句子、记忆、跟读和情景对话完成一节课。

当前仓库已经包含可运行的 Expo 学生端。根页面使用 Expo DOM 承载现阶段的高保真视觉实现，默认课程数据为 10 节 Dudulu 英语启蒙 mock 课程。

## 当前功能

- 真实账号登录、JWT 会话轮换与学生身份选择
- 学生首页、课程学习、AI 伙伴、作业和成长页面
- 独立错题复习入口，进入答题后复用课程学习播放器
- 10 节 mock 课程及课程目录、节点式学习进度
- 教材上传与内容工作台，支持 JSON、Markdown、DOCX、PDF 和扫描件 OCR 排队
- 草稿校验、管理员审核、不可变课程版本、发布、下架和回滚
- 学生端自动读取后端已发布课程，未审核内容不可见
- 云端学习事件与课程进度同步，重复网络提交不会重复记账
- 同知识点错题自动合并、到期复习、掌握度与 1/3/7/14/30 天间隔调度
- 教师/管理员布置基础作业，完成度由真实课程活动自动推进
- 五种课程活动：`word`、`sentence`、`recall`、`pronunciation`、`dialog`
- Lumi 全身角色、不同学习状态和答对庆祝效果
- 手机原生麦克风录音、16kHz PCM 语音转文字
- 跟读评分（SSECP；未配置时自动使用本地 Mock）
- 阿里云英文发音（不可用时回退系统语音）、AI 对话与情景对话判定
- 单词、例句和整句正文均可直接点击播放美式英语发音
- 答题校验、错误提示、课程完成反馈
- 课程进度、作业和错题同步至服务端；签到、星星、书籍与设置仍保存在本机，可离线演示
- AI 和跟读在后端未启动时自动进入有明确标识的本地演示模式
- 记忆题采用固定单屏布局，不产生横向或纵向内部滚动
- 支持 `prefers-reduced-motion`，用户选择减少动态效果时会关闭庆祝动画

## 技术栈

| 层 | 技术 |
| --- | --- |
| 应用框架 | Expo SDK 57 + React Native 0.86 + TypeScript |
| 路由 | Expo Router |
| Web 视觉实现 | Expo DOM + CSS |
| 录音 | Expo Audio 原生 PCM Stream |
| 发音 | 阿里云 NLS TTS + Expo Audio；Expo Speech / Web Speech API 兜底 |
| 后端 | FastAPI + SQLAlchemy + PostgreSQL/SQLite + Alembic + 阿里云 NLS/SSECP + DeepSeek |
| 课程数据 | 本地 JSON mock + 后端内容库 |

当前学生端保留 Expo DOM 高保真 UI，录音和网络能力由原生父层注入，因此 Android/iOS 真机不依赖 WebView 的麦克风实现。

## 本地运行

先用项目的 conda 环境启动后端（默认使用本地 SQLite）：

```bash
cd server
conda run -n en-teach python -m pip install -r requirements.txt
cp .env.example .env
conda run -n en-teach alembic upgrade head
cd ..
conda run -n en-teach python scripts/seed_db.py
cd server
conda run --no-capture-output -n en-teach python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

本地演示学生账号为 `lumi_student`，密码为 `LumiDemo123!`；家长账号为 `lumi_parent`，密码相同。教师账号为 `lumi_teacher`，密码为 `LumiTeacher123!`；内容工作台开发管理员为 `lumi_admin`，密码为 `LumiAdmin123!`。这些账号仅用于开发环境。

需要用 PostgreSQL 联调时：

```bash
docker compose up -d postgres
# 在 server/.env 中设置：
# DATABASE_URL=postgresql+psycopg://en_teach:en_teach_dev_only@127.0.0.1:5433/en_teach
cd server
conda run -n en-teach alembic upgrade head
```

从旧 SQLite 搬迁到刚完成迁移的 PostgreSQL 空库：

```bash
conda run -n en-teach python scripts/migrate_sqlite_to_postgres.py \
  --destination 'postgresql+psycopg://en_teach:en_teach_dev_only@127.0.0.1:5433/en_teach'
```

脚本不会删除 SQLite，也不会覆盖已有业务数据的目标库；刷新会话不会迁移，用户需要重新登录。`/health` 用于进程存活检查，`/ready` 会同时验证数据库连接和 Alembic 版本。

如需接入 Sentry，在 `server/.env` 配置 `SENTRY_DSN`；默认不发送个人信息，性能采样默认关闭。

另开终端启动 App：

```powershell
cd app
npm install
npx expo start
```

指定开发端口：

```powershell
npx expo start --web --port 8083
```

其他常用命令：

```powershell
npm run android
npm run ios
npm run typecheck
npm run doctor
npm run check
npm run fix:deps
```

## 演示建议

- 完整演示路径：登录 → 学生身份 → 冒险地图 → 继续当前课程 → 完成活动并领取星星 → 作业/错题 → AI 伙伴 → 我的学习。
- 演示状态会保存在当前浏览器或手机 WebView；需要恢复初始数据时，进入“我的学习 → 设置 → 重置演示数据”。
- 首次登录真实账号时，原游客进度会复制到该账号的本地空间；后续不同用户之间互不混用。
- 电脑和手机展示同一套内容与进度。电脑更适合投屏和稳定讲解；手机额外展示原生录音、系统发音、软键盘与触控体验。
- 不启动后端仍可演示页面、课程、作业、错题、AI 本地回复和跟读本地评分；语音转文字仍需要后端服务。
- 真机联调时手机与电脑应在同一局域网，并让后端监听 `0.0.0.0:8000`。
- 内容与教师运营入口为 `http://localhost:8081/content-admin`；家长周报入口为 `http://localhost:8081/family`。内容工作台可上传 `content/examples/fruit-market.md` 走通校验、审核和发布。

更完整的现场流程和异常预案见 [演示手册](docs/demo-playbook.md)。

### 常见启动问题

- `npx` 提示临时安装 `expo@57`：通常是没有在 `app` 目录执行，或本地依赖尚未完整安装。先运行 `npm install`。
- `ENOSPC: no space left on device`：磁盘或 npm 缓存所在分区空间不足，不是 Expo 代码错误。释放空间后重新执行安装或启动命令。
- 端口被占用：换用 `--port <端口>`，或结束旧的 Expo 开发进程后重启。

## 当前应用入口

`app/src/app/index.tsx` 当前渲染：

```text
app/src/screens/StudentApp.dom.tsx
```

学生端与内容工作台都由 Expo Router 提供入口：`/` 渲染学生端，`/content-admin` 渲染内容工作台。页面集中在 `screens/`，课程分发与通用 UI 集中在 `components/`。

## 目录结构

```text
EN-teach/
├── app/
│   ├── assets/mock/             # 10 节 Dudulu mock 课程
│   ├── public/course-art/       # 教材封面和课程地图资源
│   └── src/
│       ├── app/                 # Expo Router 路由
│       ├── data/                # mock 课程加载和分节
│       ├── components/          # 课程分发器与通用 UI
│       ├── screens/             # 高保真 DOM 学生端页面
│       ├── stores/              # 本地演示状态
│       ├── styles/              # 全局学习主题
│       ├── services/            # 录音、API 与演示兜底
│       └── types/               # 课程数据类型
├── server/                      # FastAPI、SQLite、ASR/TTS/评分/AI
├── content/                     # 后端课程内容源
├── scripts/                     # 灌库与语音端到端验证
├── docs/                        # 产品、架构与课程契约文档
└── README.md
```

## Mock 课程数据

运行时读取：

```text
app/assets/mock/dudulu_fake_course_10_lessons_bundle/
└── dudulu_fake_course_flat_parser_ready.json
```

`app/src/data/mock.ts` 会根据 `sectionId` 将扁平活动列表重新组合为 10 节课。`lessons/lesson_01.json` 至 `lesson_10.json` 作为分节数据和调试样本保留。

## 课程组件契约

五种组件的数据结构以以下两处为准：

- `docs/lesson-components.md`
- `app/src/types/lesson.ts`

课程既可由本地 JSON Mock 驱动，也可从后端公开课程接口读取已发布版本。契约变更必须同步文档、前端类型、后端 Pydantic Schema 和测试数据。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [产品说明](docs/product.md) | 产品定位、学习闭环和阶段规划 |
| [架构说明](docs/architecture.md) | 架构分层、扩展机制和序列化约定 |
| [课程组件契约](docs/lesson-components.md) | 五种学习组件的 JSON 契约 |
| [后续开发计划书](docs/remaining-work-plan.md) | 从演示原型到正式产品的功能、阶段与验收计划 |
| [阶段 0 交接记录](docs/stage-0-handoff.md) | 数据库、鉴权、监控、安全检查与本地运行状态 |
| [阶段 1 内容平台](docs/content-platform.md) | 教材格式、工作台、状态权限、存储校验和回滚说明 |
| [阶段 2 学习闭环](docs/learning-loop.md) | 云端进度、幂等事件、错题合并、间隔复习与作业规则 |
| [阶段 3 积分与成长](docs/economy-growth.md) | 权威积分账本、奖励规则、商城库存、装备、成长统计与徽章 |

## 仓库约定

- `node_modules/`、`.expo/`、构建产物和本地环境变量不会进入 Git。
- 通过 `npx skills add ...` 安装到仓库的 `.skills/` 目录也已加入 `.gitignore`。
- 不要提交无关的 mock JSON 换行符变化；修改课程内容时应说明变更范围。
