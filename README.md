# EN-teach · Lumi 英语学习应用

面向小学生的卡通化英语学习应用。Lumi 作为学习伙伴在课程中进行引导，学生通过单词、句子、记忆、跟读和情景对话完成一节课。

当前仓库已经包含可运行的 Expo 学生端。根页面使用 Expo DOM 承载现阶段的高保真视觉实现，默认课程数据为 10 节 Dudulu 英语启蒙 mock 课程。

## 当前功能

- 登录与学生身份选择
- 学生首页、课程学习、AI 伙伴、作业和成长页面
- 10 节 mock 课程及课程目录、节点式学习进度
- 五种课程活动：`word`、`sentence`、`recall`、`pronunciation`、`dialog`
- Lumi 全身角色、不同学习状态和答对庆祝效果
- 发音播放、答题校验、错误提示、课程完成反馈
- 记忆题采用固定单屏布局，不产生横向或纵向内部滚动
- 支持 `prefers-reduced-motion`，用户选择减少动态效果时会关闭庆祝动画

## 技术栈

| 层 | 技术 |
| --- | --- |
| 应用框架 | Expo SDK 57 + React Native 0.86 + TypeScript |
| 路由 | Expo Router |
| Web 视觉实现 | Expo DOM + CSS |
| 发音 | Expo Speech / Web Speech API |
| 当前数据 | 本地 JSON mock 课程 |

当前阶段主要完成学生端视觉原型和课程运行时。FastAPI、数据库和真实 AI 接口尚未在本仓库落地。

## 本地运行

需要先进入 `app` 目录安装依赖：

```powershell
cd app
npm install
npx expo start --web
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
npm run fix:deps
```

### 常见启动问题

- `npx` 提示临时安装 `expo@57`：通常是没有在 `app` 目录执行，或本地依赖尚未完整安装。先运行 `npm install`。
- `ENOSPC: no space left on device`：磁盘或 npm 缓存所在分区空间不足，不是 Expo 代码错误。释放空间后重新执行安装或启动命令。
- 端口被占用：换用 `--port <端口>`，或结束旧的 Expo 开发进程后重启。

## 当前应用入口

`app/src/app/index.tsx` 当前渲染：

```text
app/src/reference/ReferenceApp.dom.tsx
```

这是目前持续调试的高保真学生端实现。`app/src/screens/` 和 `app/src/components/` 中保留了组件化页面实现，后续原生端收敛时可继续复用。

## 目录结构

```text
EN-teach/
├── app/
│   ├── assets/mock/             # 10 节 Dudulu mock 课程
│   ├── public/course-art/       # 教材封面和课程地图资源
│   └── src/
│       ├── app/                 # Expo Router 路由
│       ├── components/          # 学习组件、UI 与 Lumi 角色
│       ├── data/                # mock 课程加载和分节
│       ├── reference/           # 当前高保真 DOM 学生端
│       ├── screens/             # 组件化页面实现
│       ├── services/            # TTS 等客户端服务
│       └── types/               # 课程数据类型
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

五种组件的数据结构以以下三处为准：

- `docs/lesson-components.md`
- `app/src/types/lesson.ts`
- 后续后端 schemas

契约变更必须同步文档、前端类型和后端 schema，避免课程生成端与运行时发生字段漂移。

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
