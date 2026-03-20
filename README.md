# CupCup 酒吧管理后台

CupStation 店铺数据管理，对接 **MemFire**（bars、collected_cards、Storage 桶 `cup-images`）。

- 线上地址：https://cupcup-admin.vercel.app/

## 登录

| 项目     | 值        |
|----------|-----------|
| 账号     | `cupadmin` |
| 密码     | `cup9898`  |

## 本地运行

```bash
npm install
npm run dev
```

## 环境变量（可选）

见 `.env.example`。

- 前端可选：`VITE_MEMFIRE_URL`、`VITE_MEMFIRE_ANON_KEY`
- 后端必填（用于 `/api/admin-login` 服务端校验与审计落库）：
  - `MEMFIRE_URL`
  - `MEMFIRE_SERVICE_ROLE_KEY`

> 注意：若未配置后端环境变量，管理员登录会报错“缺少 MEMFIRE_URL 或 MEMFIRE_SERVICE_ROLE_KEY 环境变量”。

## 安全迁移（Partner）

上线前请在数据库执行：

- `sql/partner_login_security_audit.sql`（商户登录锁定/审计字段与日志表）

说明：

- 新版商户登录走服务端 `/api/partner-login`，会记录真实 IP 与登录审计。
- 历史 `SHA-256` 密码哈希在用户成功登录后会自动升级为更强哈希。
