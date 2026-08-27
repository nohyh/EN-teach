# EN-teach · AI 英语私教

面向幼儿园和小学学生的 AI 英语学习应用。Lumi 小鹿作为学习伙伴，陪伴学生完成课程学习、互动练习、智能批改、个性化巩固与英语问答。

> `feature/lumi-student-ui` 分支包含可直接运行的学生端 H5 前端原型，并已合入 `main` 的 Expo + React Native 客户端迁移内容；FastAPI 后端架构继续保留在 `server/` 与 `docs/` 中。

## 当前 H5 原型

- 学生登录与身份选择
- 首页今日任务、课程资源和签到日历
- 8 本虚拟绘本教材与独立教材库
- 《奇妙小镇冒险》7 单元纵向冒险地图
- Lumi 答题陪伴、正确/错误/停留反馈动画
- 五种课程组件：word / sentence / recall / pronunciation / dialog
- AI 英语伙伴、作业中心和成长页面

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

验证构建：

```bash
npm run build
npm run lint
node --test tests/rendered-html.test.mjs
```

## 仓库结构

```text
EN-teach/
├── app/          # H5 路由文件，以及 app/src 下的 Expo + React Native 客户端
├── components/   # LUMI H5 学生端与课程互动组件
├── public/       # 教材绘本与冒险地图素材
├── tests/        # H5 前端回归测试
├── prototype/    # LUMI 学生端 HTML 视觉原型
├── docs/         # 产品、架构与课程组件契约
├── server/       # FastAPI 后端（api → services → repositories）
└── scripts/      # 教材导入与题库生成脚本
```

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/product.md](docs/product.md) | 产品定位、学习闭环与阶段规划 |
| [docs/architecture.md](docs/architecture.md) | 前后端架构与扩展规则 |
| [docs/lesson-components.md](docs/lesson-components.md) | 五种课程组件 JSON 契约 |
| [UI提示词工程.md](UI提示词工程.md) | 学生端 UI 复刻提示词 |

## 协作规则

课程组件 JSON 或 API 字段发生变化时，应在同一个 PR 中同步更新组件契约、前端类型和后端 schema。
