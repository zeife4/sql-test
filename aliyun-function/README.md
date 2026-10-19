# 阿里云函数计算：AI 出题接口

这个目录提供可直接上传到阿里云函数计算 FC 3.0 的 Node.js HTTP 函数。静态网站本身不包含 DeepSeek Key；函数只负责生成题目，浏览器会再次执行参考 SQL 进行校验。

## 创建函数

1. 在函数计算控制台创建“事件函数”，运行时选择 Node.js 20，处理程序填写 `index.handler`。
2. 上传本目录的 `index.js`。
3. 添加环境变量：
   - `DEEPSEEK_API_KEY`：你的 DeepSeek Key。
   - `ALLOWED_ORIGIN`：GitHub Pages 的完整来源，例如 `https://your-name.github.io`；调试阶段可暂时不填。
4. 创建 HTTP 触发器，允许 `POST` 和 `OPTIONS`。需要公开访问时使用匿名触发器，并在阿里云侧设置调用限流和费用告警。
5. 把函数 HTTPS 地址填入 QueryDojo 的“设置 → AI 出题接口”。

如果控制台已提供网关级 CORS，可直接允许你的 GitHub Pages 来源和 `POST` 方法；否则函数代码会自行处理预检请求。

参考：[阿里云 HTTP 触发器](https://help.aliyun.com/zh/functioncompute/http-triggers-overview)、[环境变量](https://help.aliyun.com/zh/functioncompute/environment-variables)。
