# EN-teach · AI 英语私教

面向儿童与初级英语学习者的移动端 AI 英语学习应用。项目以虚拟角色 **Lumi** 作为学习陪伴者，将课程拆成可交互的学习活动，并围绕“学习 → 练习 → 反馈 → 复习”组织体验。

> **当前状态：移动端 MVP 已完成主要页面与学习交互；FastAPI 后端仍处于骨架 / 设计阶段。**

## 已实现内容

- 登录与角色选择
- 学习首页与课程入口
- 课程学习流程
- 作业页
- AI 助教页
- 学习成长 / 进度页
- Lumi 吉祥物与引导反馈
- TTS 标准发音播放

### 五类课程组件

| 类型 | 用途 |
| --- | --- |
| `word` | 单词认识与发音 |
| `sentence` | 句型学习与理解 |
| `recall` | 中英互译、听音识别、填空等记忆练习 |
| `pronunciation` | 跟读与发音训练 |
| `dialog` | 场景化英语对话 |

学习流程中还实现了旅程进度、正误反馈、Lumi 提示、完成庆祝等交互，使课程更接近面向儿童的游戏化学习体验。

组件数据契约见 [`docs/lesson-components.md`](docs/lesson-components.md)。

## 技术栈

### 当前已落地

| 层 | 技术 |
| --- | --- |
| App | Expo SDK 57 + React Native + TypeScript |
| 路由 | Expo Router |
| UI | React Native + Expo Linear Gradient |
| 语音 | Expo Speech |
| Web 兼容 | React Native Web |

### 后端规划

| 层 | 技术 |
| --- | --- |
| API | Python + FastAPI + Pydantic v2 |
| ORM | SQLAlchemy 2.x |
| 数据库 | SQLite |
| AI | OpenAI-compatible API |

第一版暂不引入 Redis、PostgreSQL、MQ、微服务或 Kubernetes，优先保证产品闭环与迭代速度。

## 项目结构

```text
EN-teach/
├── app/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── screens/
│       ├── services/
│       ├── data/
│       └── types/
├── server/        # FastAPI 后端骨架
├── scripts/
└── docs/
```

## 本地运行

```bash
cd app
npm install
npm start
```

可通过 Expo Go、Android / iOS 模拟器或 Web 端运行。

```bash
npm run android
npm run ios
npm run typecheck
```

## 设计原则

- **组件契约优先**：前后端围绕统一的课程 JSON 结构协作。
- **儿童友好交互**：吉祥物、即时反馈、旅程式进度和低压力重试。
- **运行时调用克制**：适合预生成的内容尽量提前生成，运行时 AI 主要服务于对话等开放任务。
- **MVP 优先**：先验证学习体验，再增加复杂基础设施。

## Roadmap

- [x] Expo / React Native 客户端骨架
- [x] 核心学习页面与导航
- [x] 五类课程活动组件
- [x] Lumi 引导、反馈与 TTS
- [ ] FastAPI API 与数据持久化
- [ ] 课程生成 / 导入流水线
- [ ] 对话类活动接入运行时 LLM
- [ ] 学习记录与个性化复习闭环

---

这个项目目前重点验证的是：**如何把 LLM 能力放进一个真正可交互、低延迟、适合儿童使用的英语学习产品，而不是把聊天框直接包装成“AI 教育”。**
