# 词芽 PhraseGrow

> 用 AI 例句和记忆曲线，在语境里记住每一个英语生词。

词芽是一个为个人使用的英语单词 / 短语复习应用。把你遇到的生词收进词库，每次复习时由 DeepSeek 生成一个**中等难度、只包含这一个进阶词**的英文句子。先读句子，再选择「认识 / 不认识」，随后查看全句中文意思和目标词释义。

界面同时适配桌面和手机，数据保存在 Neon PostgreSQL 中。

## 界面预览

| 桌面端 | 手机端 |
| --- | --- |
| ![桌面端首页](docs/preview-desktop.png) | ![手机端语境复习](docs/preview-mobile.png) |

---

## 功能

- **随手添加**：单词或短语，可附上你理解的中文释义；留空时由 AI 在第一次造句时补全。
- **AI 语境复习**：每次复习请求 DeepSeek 生成新句子，而不是反复背同一条例句。
- **难度控制**：提示词要求 12–24 个英文单词、A2–B1 词汇和语法、最多一个从句，目标词是句中唯一的进阶词汇。
- **严格校验**：服务端会检查目标词是否原样出现在句子中，不合格时自动重试一次。
- **先判断，再揭示**：阅读高亮目标词的句子 → 点击「不认识 / 认识」→ 展示全句中文翻译、目标词释义和下一次复习时间。
- **SM-2 记忆曲线**：认识则拉长间隔，不认识则 10 分钟后再出现，并自动调整每个词的 ease factor。
- **完整词库管理**：搜索、按状态筛选、编辑、删除、复习状态和下次复习时间一目了然。
- **学习概览**：待复习数量、今日进度、连续复习天数、五周复习热力图、已掌握数量。
- **响应式界面**：桌面侧栏 / 手机底栏，移动端底部抽屉式表单，安全区域适配。
- **API Key 加密存储**：可在设置页保存 Key，服务端 AES-256-GCM 加密后写入数据库，浏览器只能看到尾号。
- **系统发音**：复习时可用浏览器自带语音朗读例句，无需额外服务。
- **快捷操作**：桌面端按 `1` 选择不认识、按 `2` 选择认识、按 `Enter` 进入下一张。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、lucide-react、原生 CSS |
| 后端 | Node.js 20+、Express |
| 数据库 | Neon PostgreSQL（`pg`，启动时自动建表） |
| AI | DeepSeek Chat Completions API（JSON Output） |
| 调度 | 二值评分版 SM-2（间隔重复） |

## 快速开始

### 1. 环境要求

- Node.js **20.19+ 或 22.12+**（Vite 7 的要求）
- pnpm（也可以使用 npm，命令自行替换）

```bash
node -v
pnpm -v
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

如果当前工作目录已有 `.env`，说明数据库已经配置好，可以直接启动。

从仓库重新拉取时，先复制模板：

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

至少填写 `DATABASE_URL`：

```dotenv
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
PORT=8787
```

数据库表会在服务启动时自动创建，不需要手动执行 SQL。

### 4. 开发模式

```bash
pnpm dev
```

- 前端（带热更新）：<http://localhost:5173>
- API：<http://localhost:8787>
- Vite 会把 `/api` 代理到后端。

### 5. 生产构建

```bash
pnpm check   # 类型检查 + 生产构建
pnpm start   # Express 同时托管前端和 API
```

打开 <http://localhost:8787>。终端还会打印可供同一 Wi-Fi 下手机访问的局域网地址，例如：

```text
手机访问: http://192.168.1.23:8787
```

## 配置 DeepSeek API Key

1. 前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 创建一个 API Key。
2. 打开应用的 **设置** 页面。
3. 粘贴 Key，点击 **保存设置**，再点击 **测试连接** 验证。
4. 回到首页开始复习。

也可以通过环境变量提供：

```dotenv
DEEPSEEK_API_KEY=sk-...
```

环境变量的优先级高于网页中保存的 Key。

> 推荐模型：`deepseek-chat`。当前 API 请求使用 `response_format: json_object` 来获得稳定的结构化结果。

## 环境变量

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL / Neon 连接字符串 |
| `PORT` | 否 | HTTP 端口，默认 `8787` |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek Key；也可在设置页填写 |
| `DEEPSEEK_MODEL` | 否 | 覆盖模型名，默认 `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | 否 | 兼容 API 地址，默认 `https://api.deepseek.com` |
| `APP_SECRET` | 建议 | 加密网页中保存的 Key；部署后必须保持不变 |
| `DATA_DIR` | 否 | 本地密钥文件目录，默认 `./.data` |
| `NODE_ENV` | 否 | 生产脚本自动设为 `production`，启用生产静态缓存与 CSP |

`APP_SECRET` 若未设置，服务会自动在 `.data/app-secret` 生成并保存一把本地密钥。**部署到容器或新机器时，请显式设置一个稳定的 `APP_SECRET`，否则之前保存在数据库中的 API Key 将无法解密**（重新在设置中填写即可）。

## 复习算法

每次回答只有两种结果，服务端把它们映射为 SM-2 的质量分：

- **认识**（quality 4）
  - 新词第一次复习：**1 天**
  - 第二次复习：**3 天**
  - 之后：`上次间隔 × ease factor`（默认约 2.5，约 8 天、20 天……）
  - 复习间隔达到 **21 天**后，词条标记为「已掌握」。
- **不认识**（quality 2）
  - 间隔与重复次数重置，**10 分钟**后重新出现。
  - ease factor 会下调，最低为 1.3。
  - 解锁「学习中」状态。

所有时间均由数据库和服务器生成，`review_logs` 表保存每次复习的评分、前后间隔、AI 例句与时间，可用于后续分析或切换更复杂的算法（如 FSRS）。

## AI 造句与校验

每次进入一张新词卡时会请求：

```text
POST /api/words/:id/sentence
```

服务端会：

1. 从环境变量或加密设置中读取 Key。
2. 带上目标词和用户释义调用 DeepSeek。
3. 要求返回严格 JSON：`sentence`、`sentence_zh`、`target_meaning_zh`、`part_of_speech`。
4. 校验目标词是否以完整词 / 完整短语原样出现、词数是否合理。
5. 校验失败时自动以更严格的提示重试一次。
6. 成功结果在内存中缓存 5 分钟，避免刷新页面重复扣费。
7. 如果该词还没有释义，把 AI 返回的 `target_meaning_zh` 自动写回词库。

没有配置 Key 时，复习页会显示配置提示；调用失败会给出可操作的错误信息（Key 无效、余额不足、速率限制、超时等），不会泄露 Key。

## 项目结构

```text
.
├── server/
│   ├── index.js             # Express 入口、静态资源、安全响应头
│   ├── routes.js            # 词库 / 复习 / 统计 / 设置 API
│   ├── db.js                # 连接池与自动建表
│   ├── scheduler.js         # SM-2 调度、词条序列化
│   ├── deepseek.js          # 造句提示词、API 调用、结果校验
│   ├── settings-service.js  # 设置读取、模型选择
│   ├── crypto.js            # AES-256-GCM 加解密
│   ├── config.js
│   └── errors.js
├── src/
│   ├── pages/               # 今日 / 词库 / 复习 / 设置
│   ├── components/          # 弹窗、词条表单、句子高亮、Toast
│   ├── api.ts               # 前端 API 客户端
│   ├── types.ts
│   ├── utils.ts
│   ├── App.tsx
│   └── styles.css
├── public/                  # 图标与 PWA manifest
├── dist/public/             # pnpm build 产物
├── .env                     # 本地环境变量（已 gitignore）
└── .env.example
```

## 数据库

表结构由 `server/db.js` 在启动时自动初始化：

- `words`：词条、释义、复习间隔、ease factor、到期时间、统计数据。
- `review_logs`：每一次评分、前后间隔、AI 例句、复习时间。
- `app_settings`：DeepSeek Key（加密）和模型名。

删除词条会级联删除对应的复习记录。数据库连接只在服务端使用，不会暴露给浏览器。

## 部署建议

这是一个需要**长期运行的 Node 服务**，不能直接作为 Vercel 静态站点或纯 Serverless 函数部署。可以部署到任何支持 Node 20.19+ 的平台或 VPS：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm start` 会自动设置 `NODE_ENV=production`。

若想在部署镜像中减小体积，可以在构建完成、启动之前执行 `pnpm prune --prod`。

部署时务必设置：

```dotenv
DATABASE_URL=...
APP_SECRET=...
NODE_ENV=production
# 可选：DEEPSEEK_API_KEY
```

然后用 HTTPS 反向代理暴露 `8787` 端口。

> **重要：应用目前是单用户工具，没有内置账号系统。** 部署到公网前，请通过 Cloudflare Access、反向代理 Basic Auth 或其他访问控制来保护它，否则任何拿到地址的人都可以读取词库，并消耗你的 DeepSeek 额度。

## 安全说明

- API Key 不会返回给浏览器；设置接口只返回是否已配置和尾号。
- 保存在数据库中的 Key 使用 AES-256-GCM 加密，密钥来自 `APP_SECRET` 或本地 `.data/app-secret`。
- API 响应设置 `Cache-Control: no-store`；前端没有使用 `dangerouslySetInnerHTML`。
- 生产模式启用基础安全响应头和 CSP。
- 不要在公开仓库提交 `.env`、`.data/` 目录。
- AI 请求会把目标词及你填写的中文释义发送给 DeepSeek。请不要在词条释义中写入敏感信息。

## 常用命令

```bash
pnpm dev        # 同时启动 API 与 Vite 开发服务器
pnpm dev:server # 仅启动后端（--watch）
pnpm dev:web    # 仅启动 Vite
pnpm build      # 构建前端到 dist/public
pnpm start      # 生产模式启动服务
pnpm typecheck  # TypeScript 检查
pnpm check      # 类型检查 + 构建
```

## 已知边界

- 目前只针对**英语单词 / 短语 + 中文翻译**设计。
- 句子的语义难度由提示词约束，无法像词表分级那样对所有“其他生词”做绝对判断，但会校验目标词、长度和结构化输出。
- 每次首先生成例句；模型响应慢时，页面会显示生成中状态，并提供重试。
- AI 例句生成会按 DeepSeek 的调用计费；生成成功后 5 分钟内的重复刷新使用缓存。
- 暂未提供多用户、跨设备登录、导入 / 导出和离线模式。

---

如果它帮你记住了一个总也记不住的词，那这个小词园就算种对了。
