/**
 * MusicFree 插件订阅服务 - Express 服务器 (Zeabur 部署)
 *
 * 将 Express req/res 适配为 Netlify Functions 的 event 格式，
 * 直接复用 netlify/functions/ 中的处理逻辑，无需重复代码。
 *
 * 环境变量:
 *   PORT     - 监听端口 (默认 3000，Zeabur 自动注入)
 *   BASE_URL - 服务公开地址，用于生成插件更新链接
 *              例: https://your-app.zeabur.app
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const { handler: subscriptionHandler } = require('./netlify/functions/subscription');
const { handler: pluginHandler } = require('./netlify/functions/plugin');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 将 Express req/res 适配为 Netlify Functions 调用格式
 */
async function callNetlifyHandler(handler, req, res) {
  const event = {
    httpMethod: req.method,
    path: req.path,
    rawUrl: req.originalUrl,
    queryStringParameters: req.query,
    headers: req.headers,
  };
  const result = await handler(event, {});
  if (result.headers) {
    Object.entries(result.headers).forEach(([k, v]) => res.set(k, v));
  }
  res.status(result.statusCode).send(result.body);
}

// 屏蔽内部目录的直接访问
app.use('/netlify', (req, res) => res.status(404).end());

// 订阅接口: GET /api/subscription.json
app.get('/api/subscription.json', (req, res, next) =>
  callNetlifyHandler(subscriptionHandler, req, res).catch(next)
);

// 插件下载: GET /plugins/:plugin 和 /plugin/:plugin
app.get(['/plugins/:plugin', '/plugin/:plugin'], (req, res, next) =>
  callNetlifyHandler(pluginHandler, req, res).catch(next)
);

// 健康检查
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 静态文件服务 (index.html、404.html、music.svg 等)
app.use(express.static(__dirname, {
  index: 'index.html',
  dotfiles: 'deny',
}));

// 404 兜底
app.use((req, res) => {
  const p = path.join(__dirname, '404.html');
  if (fs.existsSync(p)) {
    res.status(404).sendFile(p);
  } else {
    res.status(404).json({ error: 'Not Found' });
  }
});

// Express 错误处理中间件 (必须有 4 个参数)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 防止未捕获的异常/rejection 导致进程退出
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`MusicFree 插件服务运行在端口 ${PORT}`);
});
