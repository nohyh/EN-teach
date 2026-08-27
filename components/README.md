# LUMI 学生端组件库

组件统一从 `components/index.ts` 导出，由页面按业务场景组合。

| 组件 | 用途 |
|---|---|
| `PhoneShell` | 移动端页面外壳和桌面预览容器 |
| `StudentPage` | 带滚动内容区及底部导航的学生页面 |
| `StatusBar` | 原型状态栏 |
| `PageHeader` | 页面标题、说明、返回和右侧状态 |
| `SectionTitle` | 内容分区标题和文字操作 |
| `Button` | Primary、Secondary、Ghost 三种按钮 |
| `Card` | 基础卡片及六种语义色调 |
| `Pill` | 状态、奖励和分类标签 |
| `ProgressBar` | 学习进度与能力进度 |
| `TaskRow` | 统一任务入口 |
| `BottomNav` | 首页、学习、AI伙伴、作业、成长五栏导航 |
| `LumiMascot` | Small、Medium、Large 三档尺寸及七种反馈状态 |
| `FloatingDecorations` | 登录及身份页的轻量装饰 |

## 学习运行组件

学习模块采用统一的 `LessonPackage` 数据入口，并只接受五类 `LessonActivity`：

| 类型 | 前端组件 | 当前交互 |
|---|---|---|
| `word` | `WordView` | 单词、词义、例句与浏览器发音 |
| `sentence` | `SentenceView` | 句子、释义、句型拆解与发音 |
| `recall` | `RecallView` | 中英互译、听写、填空与本地判定 |
| `pronunciation` | `PronunciationView` | 标准发音与录音流程演示 |
| `dialog` | `DialogView` | 场景目标、快捷回答和本地对话演示 |

五种内容均由 `LessonActivityView` 分发，并共用 `ActivityFrame` 的类型标识、吉祥物提示、课程进度和反馈区域。正式接入后端时，`recall.answer` 应由批改接口保管，发音与对话的本地演示状态替换为服务返回结果。

`LumiMascot` 的 `mood` 支持 `neutral`、`happy`、`encourage`、`curious`、`listening`、`resting`、`proud`。练习反馈分别使用跳跃庆祝、温柔点头、等待歪头、竖耳倾听、陪伴呼吸和完成勋章；所有持续动画均响应 `prefers-reduced-motion`。

设计变量、基础状态和组件样式位于 `student-ui.css`。五种学习组件样式位于 `learning-components.css`，其余业务页面专属布局位于 `app/globals.css`，避免页面样式反向污染组件库。
