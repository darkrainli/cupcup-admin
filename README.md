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
