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

见 `.env.example`。部署到 Vercel 时可在 **Settings → Environment Variables** 中配置 `VITE_MEMFIRE_URL`、`VITE_MEMFIRE_ANON_KEY`；不配置则使用代码内默认 MemFire 地址与 anon key。
