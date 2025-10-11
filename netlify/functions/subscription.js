/**
 * MusicFree 插件订阅接口 - Netlify Function
 * 端点: /.netlify/functions/subscription
 * 功能: 自动扫描插件目录，返回插件列表JSON，包含客户端信息
 */

const fs = require('fs');
const path = require('path');

// 需要 API KEY 的插件列表（原始5个插件）
const PLUGINS_REQUIRE_KEY = ['wy.js', 'mg.js', 'kg.js', 'kw.js', 'qq.js'];

/**
 * 从插件文件中提取元数据
 * 只从 module.exports 块中提取，避免匹配到其他位置的同名字段
 */
function extractPluginMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 找到 module.exports 的位置
    const moduleExportsIndex = content.lastIndexOf('module.exports');
    if (moduleExportsIndex === -1) {
      console.warn(`No module.exports found in ${filePath}`);
      return {
        platform: 'Unknown',
        version: '0.0.0',
        author: 'Unknown'
      };
    }

    // 只在 module.exports 之后搜索元数据
    const exportsContent = content.substring(moduleExportsIndex);

    // 提取 module.exports 中的信息，支持单引号、双引号和无引号
    const platformMatch = exportsContent.match(/['"]?platform['"]?\s*:\s*['"](.*?)['"]/);
    const versionMatch = exportsContent.match(/['"]?version['"]?\s*:\s*['"](.*?)['"]/);
    const authorMatch = exportsContent.match(/['"]?author['"]?\s*:\s*['"](.*?)['"]/);

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
 * 每次推送后立即更新，无缓存机制
 */
function scanPlugins() {
  console.log('Scanning plugins directory for latest versions...');

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

    console.log(`Scanned ${plugins.length} plugins successfully`);
    return plugins;

  } catch (error) {
    console.error('Error scanning plugins directory:', error);
    return [];
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
    // 从查询参数获取API Key（可选）
    let key = event.queryStringParameters?.key;

    // 如果提供了 key，移除 .json 后缀
    if (key) {
      // 移除 key 末尾的 .json 后缀（如果存在）
      // MusicFree 会在订阅链接的 key 后面自动添加 .json
      if (key.endsWith('.json')) {
        key = key.slice(0, -5);
        console.log(`Removed .json suffix from key`);
      }
    } else {
      console.log('No API key provided, generating subscription without key');
    }

    // 获取BASE_URL（从环境变量或使用默认值）
    const baseUrl = process.env.BASE_URL || process.env.URL || 'https://musicfree-plugins.netlify.app';

    // 扫描并获取所有插件
    const plugins = scanPlugins();

    // 构建插件列表
    // 需要 API KEY 的插件：如果有 key 则添加，否则不带参数
    // 不需要 API KEY 的插件（Gitcode, Bilibili, 汽水音乐）：直接访问
    const pluginsList = plugins.map(plugin => ({
      name: plugin.name,
      url: (plugin.requiresKey && key)
        ? `${baseUrl}/plugins/${plugin.file}?key=${key}`
        : `${baseUrl}/plugins/${plugin.file}`,
      version: plugin.version
    }));

    // 收集客户端信息
    const clientInfo = {
      ip: getClientIP(event.headers),
      ua: getClientUA(event.headers)
    };

    if (key) {
      console.log(`Subscription request from IP: ${clientInfo.ip} with key: ${key.substring(0, 8)}...`);
    } else {
      console.log(`Subscription request from IP: ${clientInfo.ip} without key (returning all plugins)`);
    }

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
