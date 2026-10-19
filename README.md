# QueryDojo

一个可部署到 GitHub Pages、阿里云 OSS、Cloudflare Pages 等静态托管平台的 SQL 在线练习站。SQL 在浏览器的独立 Web Worker 中由 SQLite WebAssembly 真实执行，判题和历史记录都不依赖服务器。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

完整检查：

```bash
npm run typecheck
npm test
npm run build
```

`npm run build` 会生成可直接静态托管的 `out/` 目录。

## 发布到 GitHub Pages

1. 新建 GitHub 仓库并把本项目推送到 `main` 分支。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
4. 推送代码或手动运行 **Deploy QueryDojo to GitHub Pages** 工作流。

工作流会自动检测 GitHub Pages 的项目子路径，执行类型检查、测试、静态构建并发布 `out/`。普通项目仓库的访问地址通常为：

```text
https://<用户名>.github.io/<仓库名>/
```

如果要使用自定义域名，在 GitHub Pages 设置中绑定即可；发布工作流返回的 `base_path` 会用于构建资源路径。

## 可选：接入 AI 出题

纯静态版本默认使用 50 道内置题，不需要任何 Key。要启用 DeepSeek 动态出题：

1. 按 [aliyun-function/README.md](./aliyun-function/README.md) 创建阿里云函数计算 HTTP 接口。
2. 把 `DEEPSEEK_API_KEY` 放入函数环境变量，不要放进本仓库。
3. 在网站的“设置”页面填写函数 HTTPS 地址。

AI 接口不可用、返回格式错误或参考 SQL 无法执行时，页面会自动回退到内置题库。

## 实现结构

```text
app/                         静态页面：练习、历史、设置、说明
components/                  响应式界面、CodeMirror、结果与历史视图
data/fallback-bank.json      10 个题族 × 5 个变体，共 50 题
lib/browser-sql.ts           Web Worker 生命周期和 3 秒超时
lib/sqljs-engine.ts          SQLite WASM 建库、执行和 5000 行限制
lib/client-history.ts        IndexedDB 做题记录
workers/sql-worker.ts        隔离 SQL 执行，避免阻塞页面
aliyun-function/             可选的 DeepSeek 出题函数
.github/workflows/pages.yml  GitHub Pages 自动构建与发布
```

## 数据与安全边界

- 只允许单条 `SELECT` 或 `WITH` 查询，并拦截修改数据库的关键字。
- 每次执行使用独立内存数据库；超过 3 秒会终止 Worker，超过 5000 行会停止读取。
- 做题记录保存在当前浏览器的 IndexedDB，清除网站数据后会消失。
- 静态网站必须把参考 SQL 发送到浏览器，因此它适合练习和自测，不适合作为防作弊考试系统。
- DeepSeek Key 只保存在阿里云函数环境变量中，不进入静态网页或 GitHub Actions。

## 里程碑状态

- M1：响应式双端布局、CodeMirror、首屏内置题。
- M2：浏览器 SQLite WASM、超时、危险语句拦截、结果差异和错误分类。
- M3：可选阿里云 AI 出题接口、客户端参考答案复验、自动降级。
- M4：schema 补全、桌面快捷键和移动键盘工具条。
- M5：筛选、IndexedDB 历史、深色模式、布局持久化和 GitHub Pages 发布。
