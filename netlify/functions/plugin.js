/**
 * MusicFree 插件下载接口 - Netlify Function
 * 端点: /.netlify/functions/plugin
 * 功能: 下载插件文件并动态生成请求处理器，按音源配置注入请求逻辑和音质
 */

const fs = require('fs');
const path = require('path');
const {
  SOURCE_CONFIG,
  FREE_PLUGINS,
  DEFAULT_SOURCE,
  isSourcePlugin,
  sourceSupportsPlugin,
  getQualityOverride,
} = require('./source-config');

/**
 * 验证插件文件名（防止路径遍历攻击）
 */
function isValidPluginName(pluginName) {
  return pluginName &&
    pluginName.endsWith('.js') &&
    !pluginName.includes('..') &&
    !pluginName.includes('/') &&
    !pluginName.includes('\\');
}

/**
 * 读取插件文件
 */
function readPluginFile(pluginName) {
  const pluginPath = path.join(__dirname, '..', '..', 'plugins', pluginName);
  console.log(`Attempting to read plugin from: ${pluginPath}`);
  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Plugin file not found: ${pluginName}`);
  }
  return fs.readFileSync(pluginPath, 'utf-8');
}

/**
 * 替换插件中 module.exports 的 supportedQualities 数组
 * 仅匹配属性赋值形式 (key: [...])，不影响局部变量 (const x = [...])
 */
function replaceQualities(content, qualities) {
  if (!qualities) return content;
  const json = JSON.stringify(qualities);
  return content.replace(
    /("?supportedQualities"?\s*:\s*)\[[^\]]*\]/,
    `$1${json}`
  );
}

/**
 * 根据音源类型生成请求处理器代码 (constants + requestMusicUrl 函数)
 * 所有类型统一返回 {code: 200, url: "..."} 格式，确保插件 getMediaSource 的
 * `res.code === 200 && res.url` 检查在所有音源下都能正常工作
 *
 * @param {object} sourceConfig - 音源配置对象
 * @param {string} pluginName  - 插件文件名 (如 'wy.js')
 * @param {string} apiUrl      - API 基础地址
 * @param {string} effectiveKey - 有效 API Key
 * @param {string} updateUrl   - 插件更新地址
 */
function generateRequestHandler(sourceConfig, pluginName, apiUrl, effectiveKey, updateUrl) {
  const apiType = sourceConfig.apiType || 'query';

  // 始终声明三个常量 (UPDATE_URL 被 module.exports.srcUrl 引用)
  let code = `const API_URL = ${JSON.stringify(apiUrl)};\n`;
  code += `const API_KEY = ${JSON.stringify(effectiveKey)};\n`;
  code += `const UPDATE_URL = ${JSON.stringify(updateUrl)};\n`;

  switch (apiType) {
    // ── ikun: POST ${url}/music/url, X-API-Key, {code:200} ──
    case 'ikun':
      code += `
async function requestMusicUrl(source, songId, quality) {
  return (await axios_1.default.post(\`\${API_URL}/music/url\`, { source, musicId: songId, quality }, {
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    timeout: 10000
  })).data;
}`;
      break;

    // ── query: GET ${url}/url?source=&songId=&quality=, X-API-Key, {code:200} ──
    case 'query':
      code += `
async function requestMusicUrl(source, songId, quality) {
  return (await axios_1.default.get(\`\${API_URL}/url?source=\${source}&songId=\${songId}&quality=\${quality}\`, {
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    timeout: 10000
  })).data;
}`;
      break;

    // ── lxmusic: GET ${url}/url/${source}/${songId}/${quality}, {code:0} → 标准化为 {code:200} ──
    case 'lxmusic': {
      const authHeaderName = sourceConfig.authHeader || 'X-API-Key';
      // 有 Key 时发送认证头，无 Key 时不发送
      const headersCode = effectiveKey
        ? `{ ${JSON.stringify(authHeaderName)}: API_KEY, "Content-Type": "application/json" }`
        : `{ "Content-Type": "application/json" }`;
      code += `
async function requestMusicUrl(source, songId, quality) {
  var resp = await axios_1.default.get(\`\${API_URL}/url/\${source}/\${songId}/\${quality}\`, {
    headers: ${headersCode},
    timeout: 10000
  });
  var body = resp.data;
  if (body && body.code === 0 && body.url) return { code: 200, url: body.url };
  if (body && body.url) return { code: 200, url: body.url };
  return body;
}`;
      break;
    }

    // ── changqing: 按平台独立 URL, 音质映射 (standard/exhigh/lossless) ──
    case 'changqing': {
      const platformUrl = sourceConfig.platformUrls && sourceConfig.platformUrls[pluginName];
      if (!platformUrl) {
        code += `
async function requestMusicUrl(source, songId, quality) {
  throw new Error("Platform not configured for this source");
}`;
      } else {
        code += `
var _CQ_QUALITY_MAP = ${JSON.stringify(sourceConfig.qualityMap || {})};
async function requestMusicUrl(source, songId, quality) {
  var level = _CQ_QUALITY_MAP[quality] || quality;
  return { code: 200, url: \`${platformUrl}?type=mp3&id=\${songId}&level=\${level}\` };
}`;
      }
      break;
    }

    // ── 默认: 同 query 类型 ──
    default:
      code += `
async function requestMusicUrl(source, songId, quality) {
  return (await axios_1.default.get(\`\${API_URL}/url?source=\${source}&songId=\${songId}&quality=\${quality}\`, {
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    timeout: 10000
  })).data;
}`;
  }

  return code;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // ── 提取插件名 ──
    let pluginName = event.queryStringParameters?.plugin;
    if (!pluginName) {
      const reqPath = event.path || event.rawUrl || '';
      const match = reqPath.match(/\/plugins?\/([^/?]+\.js)/);
      if (match) pluginName = match[1];
    }

    if (!pluginName) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing plugin name' })
      };
    }

    if (!isValidPluginName(pluginName)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid plugin name' })
      };
    }

    // ── 免密插件: 直接返回原文件 ──
    if (!isSourcePlugin(pluginName)) {
      let content;
      try {
        content = readPluginFile(pluginName);
      } catch (error) {
        return {
          statusCode: 404,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Plugin '${pluginName}' not found` })
        };
      }
      console.log(`Serving free plugin: ${pluginName}`);
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/javascript; charset=utf-8',
          'Content-Disposition': `inline; filename=${pluginName}`,
          'Cache-Control': 'no-cache'
        },
        body: content
      };
    }

    // ── 音源相关插件: 需要 source 参数 ──
    let source = event.queryStringParameters?.source || DEFAULT_SOURCE;

    // 剥离 .json 后缀 (MusicFree 会自动追加)
    if (source.endsWith('.json')) {
      source = source.slice(0, -5);
    }

    const sourceConfig = SOURCE_CONFIG[source];
    if (!sourceConfig) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Invalid source: ${source}` })
      };
    }

    // 检查此音源是否支持该插件
    if (!sourceSupportsPlugin(source, pluginName)) {
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Source '${source}' does not support plugin '${pluginName}'` })
      };
    }

    const apiUrl = sourceConfig.url;
    console.log(`Using source: ${source} -> ${apiUrl}`);

    // ── 确定有效 Key ──
    let effectiveKey;
    if (sourceConfig.requiresKey) {
      // 用户提供的 Key
      let key = event.queryStringParameters?.key;
      if (key && key.endsWith('.json')) {
        key = key.slice(0, -5);
      }
      effectiveKey = key || '';
    } else {
      // 内置 Key
      effectiveKey = sourceConfig.builtinKey || '';
    }

    // ── 读取插件文件 ──
    let pluginContent;
    try {
      pluginContent = readPluginFile(pluginName);
    } catch (error) {
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Plugin '${pluginName}' not found` })
      };
    }

    // ── 构建更新 URL ──
    const baseUrl = process.env.BASE_URL || process.env.URL || 'https://musicfree-plugins.netlify.app';
    let updateUrl = `${baseUrl}/plugins/${pluginName}?source=${source}`;
    if (sourceConfig.requiresKey && effectiveKey) {
      updateUrl += `&key=${effectiveKey}`;
    }

    // ── 生成并注入请求处理器 ──
    let modifiedContent = pluginContent;

    const handlerCode = generateRequestHandler(sourceConfig, pluginName, apiUrl, effectiveKey, updateUrl);
    modifiedContent = modifiedContent.replace('// {{REQUEST_HANDLER}}', handlerCode);

    // ── 音质覆盖 (按音源配置) ──
    const qualities = getQualityOverride(source, pluginName);
    modifiedContent = replaceQualities(modifiedContent, qualities);

    console.log(`Serving plugin: ${pluginName}, source: ${source}, apiType: ${sourceConfig.apiType || 'query'}, key: ${sourceConfig.requiresKey ? (effectiveKey ? effectiveKey.substring(0, 8) + '...' : '(none)') : '(builtin)'}, qualities: ${qualities ? JSON.stringify(qualities) : 'default'}`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Disposition': `inline; filename=${pluginName}`,
        'Cache-Control': 'no-cache'
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
