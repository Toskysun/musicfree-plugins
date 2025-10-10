/**
 * MusicFree 插件下载接口 - Netlify Function
 * 端点: /.netlify/functions/plugin
 * 功能: 下载插件文件并动态替换API Key占位符
 */

const fs = require('fs');
const path = require('path');

/**
 * 验证插件文件名（防止路径遍历攻击）
 */
function isValidPluginName(pluginName) {
  // 只允许 .js 文件，且不包含路径分隔符
  return pluginName &&
    pluginName.endsWith('.js') &&
    !pluginName.includes('..') &&
    !pluginName.includes('/') &&
    !pluginName.includes('\\');
}

/**
 * 读取插件文件
 * 插件文件位于仓库根目录的 plugins/ 目录
 */
function readPluginFile(pluginName) {
  // Netlify Functions运行在项目根目录的上下文中
  // 插件文件在 plugins/ 目录，相对于functions目录为 ../../plugins/
  const pluginPath = path.join(__dirname, '..', '..', 'plugins', pluginName);

  console.log(`Attempting to read plugin from: ${pluginPath}`);

  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin file not found: ${pluginName}`);
  }

  return fs.readFileSync(pluginPath, 'utf-8');
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
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
    const key = event.queryStringParameters?.key;

    // 验证API Key
    if (!key) {
      console.warn('Missing API key for plugin request');
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Missing 'key' parameter" })
      };
    }

    // 从路径中提取插件名称
    // 路径格式: /plugins/wy.js 或 /.netlify/functions/plugin
    let pluginName = event.queryStringParameters?.plugin;

    // 如果没有从查询参数获取到，尝试从路径中提取
    if (!pluginName) {
      const path = event.path || event.rawUrl || '';
      console.log(`Extracting plugin name from path: ${path}`);

      // 匹配 /plugins/xxx.js 或 /plugin/xxx.js
      const match = path.match(/\/plugins?\/([^/?]+\.js)/);
      if (match) {
        pluginName = match[1];
        console.log(`Extracted plugin name: ${pluginName}`);
      }
    }

    if (!pluginName) {
      console.error('Missing plugin name in request');
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing plugin name' })
      };
    }

    // 验证插件名称
    if (!isValidPluginName(pluginName)) {
      console.error(`Invalid plugin name: ${pluginName}`);
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid plugin name' })
      };
    }

    // 读取插件文件
    let pluginContent;
    try {
      pluginContent = readPluginFile(pluginName);
    } catch (error) {
      console.error(`Plugin file not found: ${pluginName}`);
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Plugin '${pluginName}' not found` })
      };
    }

    // 替换YOUR_KEY占位符为用户的API Key
    const modifiedContent = pluginContent.replace(/YOUR_KEY/g, key);

    console.log(`Serving plugin: ${pluginName} with key: ${key.substring(0, 8)}...`);

    // 返回JavaScript内容
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Disposition': `inline; filename=${pluginName}`,
        'Cache-Control': 'no-cache' // 禁用缓存确保Key更新
      },
      body: modifiedContent
    };

  } catch (error) {
    console.error('Plugin download error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
