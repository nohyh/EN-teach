# 阶段 1：教材内容平台使用说明

## 使用入口

- 学生端：`http://localhost:8083/`
- 内容工作台：`http://localhost:8083/content-admin`
- 本地管理员：`lumi_admin` / `LumiAdmin123!`（只用于开发环境）

工作台覆盖教材上传、解析结果、课程草稿编辑、契约校验、管理员审核、发布和下架。已发布课程由学生端公开课程接口加载；未审核草稿不会暴露给学生接口。

## 教材格式

首期支持 JSON、UTF-8 Markdown/TXT、DOCX 和含文本层的 PDF。PNG/JPEG/WebP/TIFF 扫描件会登记为 `ocr_pending`，等待后续接入 OCR 服务，不会误生成空课程。

最简单的 Markdown 约定：

```markdown
# 第一课
apple - 苹果
I like apples. | 我喜欢苹果。
```

标题会成为小节；英中内容对可使用 ` - `、` | ` 或 Tab 分隔。单词和句子会自动扩展为五类候选教学活动，发布前必须由人工检查。可直接上传 [`content/examples/fruit-market.md`](../content/examples/fruit-market.md) 验证完整流程。

JSON 可直接使用 `docs/lesson-components.md` 的课程结构，也兼容当前 Mock 的扁平 `activities + sectionId + sectionTitle` 结构。

## 状态与权限

```text
uploaded → parsing → parsed/draft → ready_for_review → approved → published
                   ↘ parse_failed     ↘ rejected
图片扫描件 → ocr_pending
```

- `teacher` 与 `admin` 可上传、查看和编辑自己有权管理的草稿。
- 只有 `admin` 可通过、驳回、发布、下架和回滚。
- 学生端 `GET /api/v1/courses` 只返回当前已发布版本。
- 每次发布创建新的不可变 `course_versions` 记录；修改已发布内容必须从历史版本新建草稿。

## 存储与校验

本地开发使用 `CONTENT_STORAGE_DIR` 指向的文件对象存储适配器，数据库只保存随机对象键、SHA-256、大小和元数据，不保存文件二进制。生产环境应把同一存储接口替换成 OSS/S3，并使用签名 URL；这项切换不改变课程数据模型。

上传会检查角色、扩展名、基础文件签名、大小、EICAR 测试特征和版权确认。解析错误包含 JSON 行列、PDF 页码或契约字段路径。默认最大文件大小为 25 MiB，可用 `CONTENT_MAX_UPLOAD_MB` 调整。

## 回滚

工作台 API 可列出一个课程的全部版本，并把 `current_version_id` 原子切回旧版本。历史版本内容不被修改。当前简化 UI 提供下架；回滚可通过：

```text
POST /api/v1/content/courses/{course_id}/versions/{version_number}/rollback
```

## 验证命令

```bash
cd server
conda run --no-capture-output -n en-teach pytest -q
cd ../app
npm run check
```
