# 阶段 2：云端学习闭环

## 数据流

```text
课程作答
  → learning_events（幂等事件）
  → learning_progress（每课服务端进度）
  → 答错时合并 knowledge_points / wrong_items
  → 到期题进入 review_sessions
  → wrong_attempts 更新掌握度与下次复习时间
  → 同步推进匹配的 assignment_progress
```

`learning_events.idempotency_key` 和 `wrong_attempts.idempotency_key` 均有唯一约束。客户端在网络重试时提交相同事件不会重复累计错误、进度或复习次数。

## 复习规则

- 首次答错或复习再次答错：次日复习，掌握度回到 0。
- 复习正确：按掌握度使用 1、3、7、14、30 天间隔。
- 连续三次复习正确且进入 14 天间隔后标记 `mastered`。
- 已掌握知识点再次答错会恢复为 `active`，并保留历史错误和复习次数。
- 每个复习会话默认最多 15 题，接口上限为 30 题。

时间统一以服务端 UTC 为准，客户端只负责显示。

## 主要接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/v1/me/learning-events` | 幂等提交作答并推进进度、错题和作业 |
| `GET` | `/api/v1/me/progress` | 当前用户全部云端课程进度 |
| `GET` | `/api/v1/me/wrong-items` | 查询活跃或已掌握错题 |
| `GET` | `/api/v1/me/reviews/due` | 查询服务器判定的到期错题 |
| `POST` | `/api/v1/me/review-sessions` | 创建今日复习会话 |
| `POST` | `/api/v1/me/review-sessions/{id}/answers` | 提交复习结果并推进掌握度 |
| `POST` | `/api/v1/assignments` | 教师/管理员给学生布置作业 |
| `GET` | `/api/v1/assignments` | 按角色查询作业及真实进度 |

发布课程的事件会由后端根据不可变课程版本重新读取活动正文、答案、类型和总题数，防止客户端伪造课程结构。仓库 Mock 课程仍允许使用稳定的 `mock:*` 引用，供开发演示。

## 前端行为

- 登录后从服务端读取进度，并把较新的云端结果合并到本地离线缓存。
- 每完成一个活动就提交学习事件；网络失败不阻断本地学习，下次活动可继续同步。
- “作业”页展示教师布置的云端作业，百分比不能由学生手工修改。
- “错题本”页展示跨设备错题和掌握度；到期题复用现有课程播放器作答。

完整的离线事件队列与双向冲突处理属于阶段后续的 E15；当前版本保证已成功提交事件的跨设备一致性。

## 验证

```bash
cd server
conda run --no-capture-output -n en-teach pytest -q
cd ../app
npm run check
```

核心测试覆盖：身份隔离、事件重复提交、同知识点错题合并、三轮间隔复习、掌握后复发、作业自动完成和未登录拒绝访问。
