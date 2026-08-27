# 架构说明

## 总览

```text
┌─────────────────────────┐        ┌──────────────────────────────────┐
│ Expo App (RN + TS)      │  HTTP  │ FastAPI (Python)                 │
│                         │ ─────► │  api/          路由层             │
│  app/            页面    │        │   └► services/  业务编排           │
│  LessonRenderer  分发器  │ ◄───── │       └► repositories/ 数据访问   │
│  components/     五卡片  │  JSON  │            └► SQLite (4 张表)     │
│  stores/         Zustand │        │                                  │
│  services/       请求出口 │        │  ├── ai_service      LLM(兼容 OpenAI)│
└─────────────────────────┘        │  └── speech_service   TTS / 发音评测 │
                                   └──────────────────────────────────┘
```

## 后端三层规则

严格保持 `api → service → repository → db` 的单向依赖：

- **api/**：只做参数校验（Pydantic）与 HTTP 编码，禁止出现 SQL 和业务判断；
- **services/**：所有业务决策在这里。例如「这一节怎么排课」集中在
  `lesson_service`，未来个性化算法只改这一个文件；
- **repositories/**：唯一的 SQLAlchemy 使用者，向上返回 ORM 模型或简单查询结果；
- services 之间可以互调，repository 不允许反向 import service。

例外：`db/database.py` 提供 `get_db` 会话依赖，供 api 层注入后传给 repository。

## 前端分发器模式

一切课程内容统一渲染入口是 `components/lesson/LessonRenderer.tsx`，
按 `component.type` switch 到五张卡片：

```tsx
switch (data.type) {
  case "word": return <WordCard data={data} />;
  case "sentence": return <SentenceCard data={data} />;
  case "recall": return <RecallCard data={data} />;
  case "pronunciation": return <PronunciationCard data={data} />;
  case "dialog": return <DialogCard data={data} />;
}
```

新增题型（listening / spelling / multiple_choice ...）= 新增一张卡片 + 一个 case，
页面层不需要动。这是前端唯一允许出现"按类型分支"的位置。

## 数据契约约定

1. **唯一契约源**：`docs/lesson-components.md`。任何字段改动必须同步三处：
   文档 + `app/types/lesson.ts` + `server/app/schemas/lesson.py`（详见 workflow.md）。
2. **JSON 键名**：接口输出保持契约文档原样键名
   （包括历史上的驼峰字段 `exampleMeaning`）。除这些既有字段外，**后续新增字段一律 snake_case**。
3. **Python 内部**：Pydantic 模型属性用 snake_case，通过 `Field(alias=...)` 与 JSON 键映射，
   `populate_by_name=True`。
4. **包装层**：课程流接口返回 `{ id, component }` 数组——数据库资源 id 包在外的信封结构；
   `message` 属于组件内部字段，不在信封重复。
5. **通用约定**：时间 ISO8601 UTC；主键一律 int 自增；错误响应统一 `{ "detail": "..." }`（FastAPI 默认）。

## 配置管理

全部环境变量集中在 `server/app/core/config.py`（pydantic-settings），
前端通过 `EXPO_PUBLIC_*` 环境变量读取后端地址（`app/services/api.ts`）。
清单见 `server/.env.example`。密钥永不入库。

## 扩展预留（不实现，只是不堵死）

- 数据库换 PostgreSQL：SQLAlchemy + Base 已就绪，仅换连接串；
- 迁移工具 Alembic：P1 结束、表结构稳定后引入；
- 音频文件本地存储 → OSS/S3：speech_service 内部收敛；
- 新题型组件：信封 + 分发器模式天然支持。
