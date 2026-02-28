# CupCup 酒吧管理后台

CupStation 店铺数据管理，对接 **MemFire**（bars、collected_cards、bar_events、Storage 桶 `cup-images`）。

- **线上地址**：https://cupcup-admin.vercel.app/

## 入口

| 角色   | 路径                     | 说明           |
|--------|--------------------------|----------------|
| 管理员 | `/` 或 `/admin/audit-activities` | 门店管理、活动审核、生成商户账号 |
| 商户   | `/partner/login`         | 商户登录后发布/编辑活动 |

## 管理员登录

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

见 `.env.example`。部署到 Vercel 时可在 **Settings → Environment Variables** 中配置 `VITE_MEMFIRE_URL`、`VITE_MEMFIRE_ANON_KEY`；不配置则使用代码内默认 MemFire 地址与 anon key。
