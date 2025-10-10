/**
 * MusicFree 插件订阅接口 - Netlify Function
 * 端点: /.netlify/functions/subscription
 * 功能: 返回插件列表JSON，包含客户端信息
 */

const PLUGINS = [
  { name: "网易云音乐", file: "wy.js", version: "0.2.0" },
  { name: "咪咕音乐", file: "mg.js", version: "0.2.0" },
  { name: "酷狗音乐", file: "kg.js", version: "0.2.0" },
  { name: "酷我音乐", file: "kw.js", version: "0.2.0" },
  { name: "QQ音乐", file: "qq.js", version: "0.2.0" }
];

/**
 * 获取客户端真实IP地址
 * 优先从X-Forwarded-For头获取（处理Netlify CDN代理场景）
 */
function getClientIP(headers) {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For可能包含多个IP，取第一个
    return forwarded.split(',')[0].trim();
  }
  return headers['client-ip'] || 'unknown';
}

/**
 * 获取客户端User-Agent
 */
function getClientUA(headers) {
  return headers['user-agent'] || 'unknown';
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  // 处理OPTIONS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // 只接受GET请求
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 从查询参数获取API Key
    let key = event.queryStringParameters?.key;

    // 验证API Key
    if (!key) {
      console.warn('Missing API key in subscription request');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing 'key' parameter" })
      };
    }

    // 移除 key 末尾的 .json 后缀（如果存在）
    // MusicFree 会在订阅链接的 key 后面自动添加 .json
    if (key.endsWith('.json')) {
      key = key.slice(0, -5);
      console.log(`Removed .json suffix from key`);
    }

    // 获取BASE_URL（从环境变量或使用默认值）
    const baseUrl = process.env.BASE_URL || process.env.URL || 'https://musicfree-plugins.netlify.app';

    // 构建插件列表
    const pluginsList = PLUGINS.map(plugin => ({
      name: plugin.name,
      url: `${baseUrl}/plugins/${plugin.file}?key=${key}`,
      version: plugin.version
    }));

    // 收集客户端信息
    const clientInfo = {
      ip: getClientIP(event.headers),
      ua: getClientUA(event.headers)
    };

    console.log(`Subscription request from IP: ${clientInfo.ip}`);

    // 返回订阅数据
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        plugins: pluginsList,
        yourinfo: clientInfo
      })
    };

  } catch (error) {
    console.error('Subscription error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
