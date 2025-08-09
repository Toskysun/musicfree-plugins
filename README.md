# MusicFree 音源插件仓库

这是 MusicFree 音乐播放器的音源插件仓库，包含各大音乐平台的插件。

## 📦 插件列表

| 插件名称 | 文件 | 版本 | 功能 |
|---------|------|------|------|
| 网易云音乐 | [wy.js](./wy.js) | 0.2.0 | 搜索、播放、歌单、歌词 |
| QQ音乐 | [qq.js](./qq.js) | 0.2.0 | 搜索、播放、歌单、歌词 |
| 酷狗音乐 | [kg.js](./kg.js) | 0.2.0 | 搜索、播放、歌单、歌词 |
| 酷我音乐 | [kw.js](./kw.js) | 0.2.0 | 搜索、播放、歌单、歌词 |
| 咪咕音乐 | [mg.js](./mg.js) | 0.2.0 | 搜索、播放、无损音质 |

## 🚀 使用方法

### 方法1：直接导入单个插件
1. 打开 MusicFree
2. 进入插件管理
3. 选择"从网络安装插件"
4. 输入插件地址：
   ```
   https://raw.githubusercontent.com/[your-username]/musicfree-plugins/main/wy.js
   ```

### 方法2：使用订阅服务一键导入
配合 [musicfree-plugin-subscription](https://github.com/[your-username]/musicfree-plugin-subscription) 项目使用，可实现一键导入所有插件。

## ⚙️ 配置说明

### 卡密配置
插件中的卡密使用 `YOUR_KEY` 作为占位符：
```javascript
const API_KEY = "YOUR_KEY";
```

使用时需要：
1. 手动替换为实际卡密
2. 或使用动态替换服务（Cloudflare Workers/Vercel）

### 更新卡密脚本

**Windows:**
```batch
@echo off
for %%f in (*.js) do (
    powershell -Command "(Get-Content '%%f') -replace 'YOUR_KEY', '%1' | Set-Content '%%f'"
)
```

**Linux/Mac:**
```bash
#!/bin/bash
for file in *.js; do
    sed -i "s/YOUR_KEY/$1/g" "$file"
done
```

## 📝 插件开发

### 插件结构
每个插件都需要实现以下接口：
- `search` - 搜索音乐
- `getMediaSource` - 获取播放链接
- `getLyric` - 获取歌词
- `getAlbumInfo` - 获取专辑信息
- `getArtistWorks` - 获取歌手作品
- `getTopLists` - 获取榜单
- `getRecommendSheetTags` - 获取歌单标签
- `getMusicSheetInfo` - 获取歌单详情

### 插件模板
```javascript
const API_URL = "https://api.example.com";
const API_KEY = "YOUR_KEY";

module.exports = {
    platform: "插件名称",
    version: "0.2.0",
    author: "作者",
    
    async search(query, page, type) {
        // 搜索实现
    },
    
    async getMediaSource(musicItem, quality) {
        // 获取播放链接
    },
    
    // ... 其他方法
}
```

## 🔄 更新日志

### v0.2.0 (2024-08-09)
- 优化插件性能
- 修复已知问题
- 统一版本号管理

### v0.1.9
- 初始版本

## ⚠️ 免责声明

- 本项目仅供学习交流使用
- 请勿用于商业用途
- 音乐版权归原作者所有
- 使用本插件请遵守相关法律法规

## 📄 License

MIT License