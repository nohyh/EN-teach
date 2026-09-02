# EN-teach · Lumi 英语学习应用

面向小学生的卡通化英语学习应用。Lumi 作为学习伙伴在课程中进行引导，学生通过单词、句子、记忆、跟读和情景对话完成一节课。

当前仓库已经包含可运行的 Expo 学生端。根页面使用 Expo DOM 承载现阶段的高保真视觉实现，默认课程数据为 10 节 Dudulu 英语启蒙 mock 课程。

## 当前功能

- 登录与学生身份选择
- 学生首页、课程学习、AI 伙伴、作业和成长页面
- 独立错题复习入口，进入答题后复用课程学习播放器
- 10 节 mock 课程及课程目录、节点式学习进度
- 五种课程活动：`word`、`sentence`、`recall`、`pronunciation`、`dialog`
- Lumi 全身角色、不同学习状态和答对庆祝效果
- 手机原生麦克风录音、16kHz PCM 语音转文字
- 跟读评分（SSECP；未配置时自动使用本地 Mock）
- 系统英文发音、AI 对话与情景对话判定
- 单词、例句和整句正文均可直接点击播放美式英语发音
- 答题校验、错误提示、课程完成反馈
- 课程、作业、错题、签到、星星、书籍与设置保存在本机，可连续演示
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
| 发音 | Expo Speech / Web Speech API |
| 后端 | FastAPI + SQLite + 阿里云 NLS/SSECP + DeepSeek |
| 课程数据 | 本地 JSON mock + 后端内容库 |

当前学生端保留 Expo DOM 高保真 UI，录音和网络能力由原生父层注入，因此 Android/iOS 真机不依赖 WebView 的麦克风实现。

## 本地运行

先启动后端：

```powershell
cd server
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python ..\scripts\seed_db.py
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

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
- 电脑和手机展示同一套内容与进度。电脑更适合投屏和稳定讲解；手机额外展示原生录音、系统发音、软键盘与触控体验。
- 不启动后端仍可演示页面、课程、作业、错题、AI 本地回复和跟读本地评分；语音转文字仍需要后端服务。
- 真机联调时手机与电脑应在同一局域网，并让后端监听 `0.0.0.0:8000`。

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

这是唯一的学生端实现：Expo Router 只负责路由和原生能力桥接，页面集中在 `screens/`，课程分发与通用 UI 集中在 `components/`。根目录旧 Web 工程已删除，避免两套前端长期漂移。

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

课程目前由本地 JSON 驱动；契约变更必须同步文档、前端类型和 mock 数据。等后端真正提供课程流接口时，再增加对应的 Pydantic 模型，不提前维护一份空契约。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [产品说明](docs/product.md) | 产品定位、学习闭环和阶段规划 |
| [架构说明](docs/architecture.md) | 架构分层、扩展机制和序列化约定 |
| [课程组件契约](docs/lesson-components.md) | 五种学习组件的 JSON 契约 |

## 仓库约定

- `node_modules/`、`.expo/`、构建产物和本地环境变量不会进入 Git。
- 通过 `npx skills add ...` 安装到仓库的 `.skills/` 目录也已加入 `.gitignore`。
- 不要提交无关的 mock JSON 换行符变化；修改课程内容时应说明变更范围。
