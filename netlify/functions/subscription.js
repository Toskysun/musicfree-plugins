/**
 * MusicFree 插件订阅接口 - Netlify Function
 * 端点: /.netlify/functions/subscription
 * 功能: 自动扫描插件目录，返回插件列表JSON，包含客户端信息
 */

const fs = require('fs');
const path = require('path');

// 需要 API KEY 的插件列表（原始5个插件）
const PLUGINS_REQUIRE_KEY = ['wy.js', 'mg.js', 'kg.js', 'kw.js', 'qq.js'];

// 缓存对象
let cachedPlugins = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 从插件文件中提取元数据
 */
function extractPluginMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取 module.exports 中的信息
    const platformMatch = content.match(/platform\s*:\s*['"](.*?)['"]/);
    const versionMatch = content.match(/version\s*:\s*['"](.*?)['"]/);
    const authorMatch = content.match(/author\s*:\s*['"](.*?)['"]/);

    return {
      platform: platformMatch ? platformMatch[1] : 'Unknown',
      version: versionMatch ? versionMatch[1] : '0.0.0',
      author: authorMatch ? authorMatch[1] : 'Unknown'
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${filePath}:`, error);
    return {
      platform: 'Unknown',
      version: '0.0.0',
      author: 'Unknown'
    };
  }
}

/**
 * 扫描插件目录并获取所有插件信息
 */
function scanPlugins() {
  const now = Date.now();

  // 检查缓存是否有效
  if (cachedPlugins && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('Using cached plugins');
    return cachedPlugins;
  }

  console.log('Scanning plugins directory...');

  // 插件目录路径（相对于此文件的位置）
  const pluginsDir = path.join(__dirname, '../../plugins');

  try {
    const files = fs.readdirSync(pluginsDir);
    const plugins = [];

    for (const file of files) {
      // 只处理 .js 文件
      if (!file.endsWith('.js')) continue;

      const filePath = path.join(pluginsDir, file);
      const metadata = extractPluginMetadata(filePath);

      plugins.push({
        name: metadata.platform,
        file: file,
        version: metadata.version,
        author: metadata.author,
        requiresKey: PLUGINS_REQUIRE_KEY.includes(file)
      });

      console.log(`Found plugin: ${file} (${metadata.platform} v${metadata.version})`);
    }

    // 更新缓存
    cachedPlugins = plugins;
    cacheTimestamp = now;

    console.log(`Scanned ${plugins.length} plugins, cache valid for ${CACHE_TTL / 1000}s`);
    return plugins;

  } catch (error) {
    console.error('Error scanning plugins directory:', error);
    // 如果扫描失败，返回旧缓存或空数组
    return cachedPlugins || [];
  }
}

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

    // 扫描并获取所有插件
    const plugins = scanPlugins();

    // 构建插件列表
    // 需要 API KEY 的插件：添加 key 参数
    // 不需要 API KEY 的插件（Gitcode, Bilibili, 汽水音乐）：直接访问
    const pluginsList = plugins.map(plugin => ({
      name: plugin.name,
      url: plugin.requiresKey
        ? `${baseUrl}/plugins/${plugin.file}?key=${key}`
        : `${baseUrl}/plugins/${plugin.file}`,
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
