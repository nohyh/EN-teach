# EN-teach · AI 英语私教

面向学生的 AI 英语学习应用：虚拟角色居中讲解，下方展示互动组件，
课程内容由五种组件构成（word / sentence / recall / pronunciation / dialog）。

> **仓库当前状态：只初始化了目录结构与设计文档，还没有任何代码。**
> 五种组件的数据结构是前后端唯一契约，见 [docs/lesson-components.md](docs/lesson-components.md)。

## 技术栈约定

| 层 | 技术 | 用途 |
| --- | --- | --- |
| App | Expo + React Native + TypeScript（Expo Router） | iOS / Android 客户端 |
| 状态 | Zustand | 课程流、学生状态 |
| 后端 | Python + FastAPI + Pydantic v2 | API、教学逻辑 |
| ORM | SQLAlchemy 2.x | 数据库访问 |
| 数据库 | SQLite | 第一版唯一存储 |
| AI | OpenAI 兼容接口 | 题库生成、dialog 运行时对话 |

第一版明确不做：Redis / Docker / PostgreSQL / MQ / 微服务 / K8s。

## 目录结构（当前仅保留两级，细分目录搭脚手架时再建）

```text
EN-teach/
├── app/        # Expo + React Native 客户端（页面/组件/状态/类型等子目录届时生成）
├── server/     # FastAPI 后端（api → services → repositories 三层）
│   ├── app/    #   业务代码：路由、模型、schema、服务编排
│   └── tests/
├── scripts/    # 教材导入 / LLM 批量生成题库脚本
├── docs/       # ★ 设计文档
└── README.md
```

## 下一步（两端脚手架落地时参考）

- `server/`：`requirements.txt` + `uvicorn app.main:app --reload`，先跑通 `/health`
- `app/`：Expo SDK 57 脚手架（`create-expo-app` 或手写配置），真机连后端用
  `EXPO_PUBLIC_API_BASE_URL=http://<电脑局域网IP>:8000`

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/product.md](docs/product.md) | 产品定位、学习闭环、阶段规划 |
| [docs/architecture.md](docs/architecture.md) | 架构分层、扩展机制、序列化约定 |
| [docs/lesson-components.md](docs/lesson-components.md) | ★ 五种组件 JSON 契约 |

## 协作一句话规则

契约变更（组件 JSON / API 字段）必须在一个 PR 内同步三处：
`docs/lesson-components.md` + 前端 types + 后端 schemas，缺一不合入。
