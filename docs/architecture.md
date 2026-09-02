# 架构说明

## 总览

```text
┌─────────────────────────┐        ┌──────────────────────────────────┐
│ Expo App (RN + DOM)     │  HTTP  │ FastAPI (Python)                 │
│                         │ ─────► │  api/          路由层             │
│  src/app/index   原生桥  │        │   └► services/  业务编排           │
│  screens/        唯一 UI │ ◄───── │       └► repositories/ 数据访问   │
│  components/     课程分发 │  JSON  │            └► SQLite             │
│  data/           课程数据 │        │                                  │
│  stores/services 状态/请求 │        │  ├── ai_service      LLM          │
└─────────────────────────┘        │  └── speech_service   TTS / 发音评测 │
                                   └──────────────────────────────────┘
```

## 后端依赖规则

当前按功能复杂度使用两条简单路径：

- 普通数据查询：`api → repository → db`；
- AI、语音和评分：`api → service`，需要持久化时再由 service 调用 repository。

`api/` 负责 Pydantic 参数校验和 HTTP 编码；`repositories/` 是唯一直接写 SQLAlchemy 查询的目录；`services/` 只承载真实存在的外部服务编排或业务规则。不为尚未出现的个性化排课提前增加空 service。

例外：`db/database.py` 提供 `get_db` 会话依赖，供 api 层注入后传给 repository。

## 前端结构

`app/src/app/index.tsx` 只负责原生录音、系统发音和 API 兜底，然后把能力传给
`app/src/screens/StudentApp.dom.tsx`。页面与课程活动只有这一套实现。

课程活动由 `app/src/components/lesson/LessonRenderer.tsx` 按 `activity.type`
分发到五种视图：

```tsx
if (activity.type === "word") return <WordCard ... />;
if (activity.type === "sentence") return <SentenceCard ... />;
if (activity.type === "recall") return <RecallCard ... />;
if (activity.type === "pronunciation") return <PronunciationCard ... />;
return <DialogCard ... />;
```

演示状态集中在 `app/src/stores/demo-state.ts`，直接使用 `localStorage`，不引入额外状态库。

## 数据契约约定

1. **唯一契约源**：`docs/lesson-components.md`。当前任何字段改动同步文档、`app/src/types/lesson.ts` 与课程 mock；后端课程接口落地后再补对应 schema。
2. **JSON 键名**：接口输出保持契约文档原样键名
   （包括历史上的驼峰字段 `exampleMeaning`）。除这些既有字段外，**后续新增字段一律 snake_case**。
3. **Python 内部**：Pydantic 模型属性用 snake_case，通过 `Field(alias=...)` 与 JSON 键映射，
   `populate_by_name=True`。
4. **包装层**：课程流接口返回 `{ id, component }` 数组——数据库资源 id 包在外的信封结构；
   `message` 属于组件内部字段，不在信封重复。
5. **通用约定**：时间 ISO8601 UTC；主键一律 int 自增；错误响应统一 `{ "detail": "..." }`（FastAPI 默认）。

## 配置管理

全部环境变量集中在 `server/app/core/config.py`（pydantic-settings），
前端通过 `EXPO_PUBLIC_*` 环境变量读取后端地址（`app/src/services/api.ts`）。
清单见 `server/.env.example`。密钥永不入库。
