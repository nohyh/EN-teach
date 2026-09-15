# 教师运营与家长周报

阶段 4 能力由 Alembic `0007_teacher_parent_ops` 至 `0011_assignment_feedback` 逐步提供数据结构。所有统计均由服务端学习事件、作业进度、发音记录、错题状态和幂等活跃计时计算，前端不能直接提交聚合统计结果。

## 教师端

- `POST /api/v1/classes` 创建班级并生成邀请码。
- `POST /api/v1/classes/join` 学生凭邀请码加入班级。
- `GET /api/v1/classes/{id}/dashboard?days=7` 查看 7、30 或 90 天统计。
- `GET /api/v1/classes/{id}/students/{student_id}/trajectory` 查看单个学生的学习事件、错题趋势和课程进度。
- `GET /api/v1/classes/{id}/dashboard.csv` 导出相同口径的明细；每次导出进入审计日志。
- `POST /api/v1/classes/{id}/assignments` 为当前班级成员生成独立作业快照，后续成员变化不会改写已有作业记录。
- `GET /api/v1/classes/{id}/assignment-batches` 与 `PATCH /api/v1/assignment-batches/{id}` 管理批次；乐观锁 `revision` 防止覆盖并发修改，已完成学生的作业快照不会被批次修改重写。
- `PUT /api/v1/assignments/{id}/feedback` 创建或修订教师评语；评语版本不匹配返回 409，每一版都会给学生生成去重站内通知。
- `POST /api/v1/assignments/{id}/feedback/response` 允许作业所属学生回复一次，教师收到站内通知。教师评语和学生回复均写入运营审计。

教师只能读取自己名下的班级，也只能给自己班级内的学生布置作业。管理员可跨班级处理运营事务。

## 家长端

- `/family` 提供家长基础周报页面。
- `GET /api/v1/parent/children` 只返回 `parent_id` 绑定到当前家长的学生。
- `GET /api/v1/parent/weekly-report` 返回最近 7 天学习活动、正确率、发音、作业、错题与课程进度。
- `GET/PUT /api/v1/me/notification-preferences` 管理周报、作业临期、复习到期和连续学习提醒偏好。
- `GET/PUT /api/v1/parent/children/{student_id}/learning-policy` 管理绑定孩子的每日 5–240 分钟上限、允许时段、时区和语音/AI 权限。
- 学生端每分钟向 `POST /api/v1/me/usage-heartbeats` 提交带幂等键的可见页面活跃时间；服务端按规则时区归档每日用量并把最后一次计时截断到剩余额度。
- `GET /api/v1/me/learning-policy` 返回学生当天已用/剩余时长和当前访问状态。学习事件、复习、ASR、评分、TTS 和 AI 接口会独立执行相同规则，关闭功能后不能通过绕过前端继续调用。

`POST /api/v1/admin/notifications/dispatch` 根据作业临期、复习到期和周报偏好生成去重的站内通知；`GET /api/v1/me/notifications` 和已读接口提供收件箱。当前通知通道为站内信，生产环境的 APNs/邮件适配仍待接入。

## 审计与积分修正

`POST /api/v1/admin/points-adjustments` 要求非零积分、明确原因和幂等键。余额仍受非负约束保护；成功修正生成积分流水和审计日志。管理员可通过 `GET /api/v1/admin/audit-logs` 检索最近操作，并通过 `GET/PATCH /api/v1/admin/reward-rules` 管理奖励数额、每日上限和上下线状态。商品上下架、课程审核、发布、回滚与报表导出也会写入审计日志。
