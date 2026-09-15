# 阶段 3：积分商城与成长系统

## 权威数据流

```text
learning_events / wrong_attempts
  → reward_rules（日上限）
  → points_transactions（不可变、幂等）
  → points_accounts（余额 + 版本）
  → purchases（购买快照）
  → user_assets（永久库存 + 当前装备）
```

积分余额只允许通过 `points_transactions` 改变。学习事件重复提交时沿用原事件，不重复触发奖励；每条奖励使用“规则 + 来源”的稳定幂等键。购买会锁定积分账户行，并在同一事务内完成扣款、购买快照和库存发放。数据库同时约束账户及流水余额不能为负数。

## 首期奖励规则

| 规则 | 单次积分 | 每日上限 |
| --- | ---: | ---: |
| 答对活动 | 2 | 60 |
| 完成课程 | 20 | 100 |
| 首次满分 | 10 | 50 |
| 掌握错题 | 8 | 80 |
| 解锁徽章 | 5 | 50 |

规则保存在数据库，可由后续运营后台调整。首期不提供转账、现金兑换或随机抽奖。

## 主要接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/me/points` | 当前积分余额和乐观锁版本 |
| `GET` | `/api/v1/me/points/transactions` | 可审计积分流水 |
| `GET` | `/api/v1/store/items` | 动态商城目录及个人拥有/装备状态 |
| `POST` | `/api/v1/store/purchases` | 幂等购买 |
| `GET` | `/api/v1/me/assets` | 永久库存 |
| `PUT` | `/api/v1/me/assets/{item_id}/equip` | 装备同类商品并卸下旧商品 |
| `GET` | `/api/v1/me/growth` | 服务端学习统计和已解锁徽章 |
| `POST/PATCH` | `/api/v1/store/items` | 管理员动态上架或下架商品 |

## 成长口径

- 学习活动数来自 `learning_events`，本周口径为最近 7 天。
- 完成课程来自 `learning_progress.status=completed`。
- 完成作业来自 `assignment_progress.status=completed`。
- 复习正确率来自 `wrong_attempts`，不使用客户端估算值。
- 徽章依据上述权威统计自动解锁；解锁记录永久保留。

## 回滚与验证

应用回滚不会删除积分、购买或库存。`0006_stage3_hardening` 只同步 PostgreSQL 序列，降级时不会倒退序列。若需回退服务版本，应保留 `0005_economy_growth` 表；只有确认所有阶段 3 数据均可丢弃时才执行 Alembic downgrade。

```bash
cd server
conda run --no-capture-output -n en-teach python -m pytest tests -q
cd ../app
npm run check
```

重点测试覆盖奖励幂等和每日上限、流水还原余额、余额不足不发货、重复购买不重复扣款、装备隔离、管理员动态上架以及未登录拒绝访问。
