const API_URL = "http://103.217.184.26:9000";
const API_KEY = "YOUR_KEY";
const UPDATE_URL = "https://musicfree-plugins.netlify.app/plugins/mg.js?key=YOUR_KEY";

// 转换字节为可读格式
function sizeFormate(size) {
  if (!size || size === 0) return '0B';
  if (size < 1024) return size + 'B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + 'KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + 'MB';
  return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
}

// 统一处理图片URL
function formatImgUrl(img) {
  if (!img) return null;
  // 如果已经是完整的URL，直接返回
  if (/^https?:/.test(img)) return img;
  // 如果以//开头，添加http:协议
  if (/^\/\//.test(img)) return 'http:' + img;
  // 否则添加咪咕图片服务器前缀
  return 'http://d.musicapp.migu.cn' + img;
}

// MD5加密函数
function toMD5(str) {
  return CryptoJS.MD5(str).toString();
}

// 创建签名
function createSignature(time, str) {
  const deviceId = '963B7AA0D21511ED807EE5846EC87D20';
  const signatureMd5 = '6cdc72a439cef99a3418d2a78aa28c73';
  const sign = toMD5(
    `${str}${signatureMd5}yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${time}`
  );
  return { sign, deviceId };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const cheerio_1 = require("cheerio");
const CryptoJS = require("crypto-js");
const searchRows = 20;
// 使用新的搜索API获取包含音质信息的结果
async function searchMusicV3(query, page, limit = searchRows) {
  const time = Date.now().toString();
  const signData = createSignature(time, query);
  
  const headers = {
    uiVersion: 'A_music_3.6.1',
    deviceId: signData.deviceId,
    timestamp: time,
    sign: signData.sign,
    channel: '0146921',
    'User-Agent':
      'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
  };
  
  const url = `https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=%7B%22song%22%3A1%2C%22album%22%3A0%2C%22singer%22%3A0%2C%22tagSong%22%3A1%2C%22mvSong%22%3A0%2C%22bestShow%22%3A1%2C%22songlist%22%3A0%2C%22lyricSong%22%3A0%7D&pageSize=${limit}&text=${encodeURIComponent(query)}&pageNo=${page}&sort=0&sid=USS`;
  
  try {
    const res = await axios_1.default.get(url, { headers });
    return res.data;
  } catch (error) {
    console.error('[咪咕] 搜索V3 API失败，回退到旧API:', error);
    // 如果新API失败，回退到旧的搜索方式
    return searchBase(query, page, 2);
  }
}

async function searchBase(query, page, type) {
  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    Connection: "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Host: "m.music.migu.cn",
    Referer: `https://m.music.migu.cn/v3/search?keyword=${encodeURIComponent(
      query
    )}`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
    "X-Requested-With": "XMLHttpRequest",
  };
  const params = {
    keyword: query,
    type,
    pgc: page,
    rows: searchRows,
  };
  const data = await axios_1.default.get(
    "https://m.music.migu.cn/migu/remoting/scr_search_tag",
    { headers, params }
  );
  return data.data;
}
function musicCanPlayFilter(_) {
  return _.mp3 || _.listenUrl || _.lisQq || _.lisCr;
}

// 基于咪咕音乐返回的数据结构优化音质检测
function getMiGuQualitiesFromSong(songData) {
  const qualities = {};
  
  // 优先从audioFormats获取音质信息（如果存在）
  if (songData.audioFormats && Array.isArray(songData.audioFormats)) {
    songData.audioFormats.forEach((format) => {
      const size = format.asize || format.isize || format.fileSize;
      
      switch (format.formatType) {
        case 'PQ': // 标准音质 128k
          qualities['128k'] = {
            size: sizeFormate(size),
            bitrate: format.bitRate || 128000,
          };
          break;
        case 'HQ': // 高音质 320k
          qualities['320k'] = {
            size: sizeFormate(size),
            bitrate: format.bitRate || 320000,
          };
          break;
        case 'SQ': // 无损音质 flac
          qualities['flac'] = {
            size: sizeFormate(size),
            bitrate: format.bitRate || 1411000,
          };
          break;
        case 'ZQ24': // Hi-Res音质
          qualities['hires'] = {
            size: sizeFormate(size),
            bitrate: format.bitRate || 2304000,
          };
          break;
      }
    });
    
    if (Object.keys(qualities).length > 0) {
      return qualities;
    }
  }
  
  // 如果没有audioFormats，使用URL字段判断（旧方式）
  // 基础音质 128k
  if (songData.mp3 || songData.listenUrl || musicCanPlayFilter(songData)) {
    qualities['128k'] = {
      size: 'N/A',
      bitrate: 128000,
    };
  }
  
  // 高音质 320k
  if (songData.lisQq || songData.hqUrl) {
    qualities['320k'] = {
      size: 'N/A',
      bitrate: 320000,
    };
  }
  
  // 无损音质 flac
  if (songData.lisCr || songData.sqUrl) {
    qualities['flac'] = {
      size: 'N/A',
      bitrate: 1411000,
    };
  }
  
  // 如果没有任何音质信息但歌曲可播放，提供基础音质
  if (Object.keys(qualities).length === 0 && musicCanPlayFilter(songData)) {
    qualities['128k'] = {
      size: 'N/A',
      bitrate: 128000,
    };
  }
  
  return qualities;
}

async function searchMusic(query, page) {
  // 尝试使用新的V3 API
  const result = await searchMusicV3(query, page);
  
  // 处理V3 API的响应
  if (result && result.code === '000000' && result.songResultData) {
    const songResultData = result.songResultData || { resultList: [], totalCount: 0 };
    const musics = [];
    
    // 处理V3 API返回的歌曲数据
    songResultData.resultList.forEach((itemArray) => {
      if (!Array.isArray(itemArray)) return;
      
      itemArray.forEach((item) => {
        if (!item.songId || !item.copyrightId) return;
        
        const qualities = {};
        
        // 从audioFormats字段获取音质信息（包含文件大小）
        if (item.audioFormats && Array.isArray(item.audioFormats)) {
          item.audioFormats.forEach((format) => {
            const size = format.asize || format.isize || format.fileSize;
            
            switch (format.formatType) {
              case 'PQ': // 标准音质 128k
                qualities['128k'] = {
                  size: sizeFormate(size),
                  bitrate: format.bitRate || 128000,
                };
                break;
              case 'HQ': // 高音质 320k
                qualities['320k'] = {
                  size: sizeFormate(size),
                  bitrate: format.bitRate || 320000,
                };
                break;
              case 'SQ': // 无损音质 flac
                qualities['flac'] = {
                  size: sizeFormate(size),
                  bitrate: format.bitRate || 1411000,
                };
                break;
              case 'ZQ24': // Hi-Res音质
                qualities['hires'] = {
                  size: sizeFormate(size),
                  bitrate: format.bitRate || 2304000,
                };
                break;
            }
          });
        }
        
        // 如果没有audioFormats，使用传统方式判断（但仍然没有size）
        if (Object.keys(qualities).length === 0) {
          if (item.mp3 || item.listenUrl) {
            qualities['128k'] = {
              size: 'N/A',
              bitrate: 128000,
            };
          }
          if (item.lisQq) {
            qualities['320k'] = {
              size: 'N/A',
              bitrate: 320000,
            };
          }
          if (item.lisCr) {
            qualities['flac'] = {
              size: 'N/A',
              bitrate: 1411000,
            };
          }
        }
        
        // 确保至少有一个音质
        if (Object.keys(qualities).length === 0) {
          qualities['128k'] = {
            size: 'N/A',
            bitrate: 128000,
          };
        }
        
        // 处理封面图片URL
        const artwork = formatImgUrl(item.img3 || item.img2 || item.img1 || item.picL || item.picM || item.picS || item.cover || item.songPic);

        musics.push({
          id: item.songId,
          artwork: artwork,
          title: item.name || item.songName,
          artist: formatSingerName(item.singerList) || item.artist,
          album: item.album || item.albumName,
          url: item.mp3 || item.listenUrl,
          copyrightId: item.copyrightId,
          singerId: item.singerId,
          qualities: qualities,
          albumId: item.albumId,
        });
      });
    });
    
    return {
      isEnd: songResultData.totalCount <= page * searchRows,
      data: musics,
    };
  }
  
  // 如果V3 API失败或返回旧格式，使用原来的处理逻辑
  if (result && result.musics) {
    const data = result;
    const musics = data.musics.map((_) => {
      const qualities = {};
      
      if (_.mp3 || _.listenUrl || musicCanPlayFilter(_)) {
        qualities['128k'] = {
          size: 'N/A',
          bitrate: 128000,
        };
      }
      
      if (_.lisQq || _.hqUrl) {
        qualities['320k'] = {
          size: 'N/A',
          bitrate: 320000,
        };
      }
      
      if (_.lisCr || _.sqUrl) {
        qualities['flac'] = {
          size: 'N/A',
          bitrate: 1411000,
        };
      }
      
      if (Object.keys(qualities).length === 0) {
        qualities['128k'] = {
          size: 'N/A',
          bitrate: 128000,
        };
      }
      
      return {
        id: _.id,
        artwork: formatImgUrl(_.picL || _.picM || _.picS || _.cover || _.songPic),
        title: _.songName,
        artist: _.artist,
        album: _.albumName,
        url: musicCanPlayFilter(_),
        copyrightId: _.copyrightId,
        singerId: _.singerId,
        qualities: qualities,
        vipFlag: _.vipFlag,
      };
    });
    
    return {
      isEnd: +data.pageNo * searchRows >= data.pgt,
      data: musics,
    };
  }
  
  return {
    isEnd: true,
    data: [],
  };
}

// 格式化歌手名称
function formatSingerName(singerList) {
  if (!singerList || !Array.isArray(singerList)) return '';
  return singerList.map(singer => singer.name || singer.singerName || '').filter(Boolean).join(', ');
}
async function searchAlbum(query, page) {
  const data = await searchBase(query, page, 4);
  const albums = data.albums.map((_) => ({
    id: _.id,
    artwork: formatImgUrl(_.albumPicL),
    title: _.title,
    date: _.publishDate,
    artist: (_.singer || []).map((s) => s.name).join(","),
    singer: _.singer,
    fullSongTotal: _.fullSongTotal,
  }));
  return {
    isEnd: +data.pageNo * searchRows >= data.pgt,
    data: albums,
  };
}
async function searchArtist(query, page) {
  const data = await searchBase(query, page, 1);
  const artists = data.artists.map((result) => ({
    name: result.title,
    id: result.id,
    avatar: formatImgUrl(result.artistPicL),
    worksNum: result.songNum,
  }));
  return {
    isEnd: +data.pageNo * searchRows >= data.pgt,
    data: artists,
  };
}
async function searchMusicSheet(query, page) {
  const data = await searchBase(query, page, 6);
  const musicsheet = data.songLists.map((result) => ({
    title: result.name,
    id: result.id,
    artist: result.userName,
    artwork: formatImgUrl(result.picL || result.picM || result.picS || result.img || result.cover),
    description: result.intro,
    worksNum: result.musicNum,
    playCount: result.playNum,
  }));
  return {
    isEnd: +data.pageNo * searchRows >= data.pgt,
    data: musicsheet,
  };
}
async function searchLyric(query, page) {
  const data = await searchBase(query, page, 7);
  const lyrics = data.songs.map((result) => ({
    title: result.title,
    id: result.id,
    artist: result.artist,
    artwork: formatImgUrl(result.img3 || result.img2 || result.img1 || result.picL || result.picM || result.picS || result.cover || result.songPic),
    lrc: result.lyrics,
    album: result.albumName,
    copyrightId: result.copyrightId,
  }));
  return {
    isEnd: +data.pageNo * searchRows >= data.pgt,
    data: lyrics,
  };
}
async function getArtistAlbumWorks(artistItem, page) {
  const headers = {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    connection: "keep-alive",
    host: "music.migu.cn",
    referer: "http://music.migu.cn",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    "Cache-Control": "max-age=0",
  };
  const html = (
    await axios_1.default.get(
      `https://music.migu.cn/v3/music/artist/${artistItem.id}/album?page=${page}`,
      {
        headers,
      }
    )
  ).data;
  const $ = (0, cheerio_1.load)(html);
  const rawAlbums = $("div.artist-album-list").find("li");
  const albums = [];
  for (let i = 0; i < rawAlbums.length; ++i) {
    const al = $(rawAlbums[i]);
    const artwork = al.find(".thumb-img").attr("data-original");
    albums.push({
      id: al.find(".album-play").attr("data-id"),
      title: al.find(".album-name").text(),
      artwork: formatImgUrl(artwork),
      date: "",
      artist: artistItem.name,
    });
  }
  return {
    isEnd: $(".pagination-next").hasClass("disabled"),
    data: albums,
  };
}
async function getArtistWorks(artistItem, page, type) {
  if (type === "music") {
    const headers = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      Connection: "keep-alive",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Host: "m.music.migu.cn",
      Referer: `https://m.music.migu.cn/migu/l/?s=149&p=163&c=5123&j=l&id=${artistItem.id}`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
      "X-Requested-With": "XMLHttpRequest",
    };
    const musicList =
      (
        await axios_1.default.get(
          "https://m.music.migu.cn/migu/remoting/cms_artist_song_list_tag",
          {
            headers,
            params: {
              artistId: artistItem.id,
              pageSize: 20,
              pageNo: page - 1,
            },
          }
        )
      ).data || {};
    return {
      data: musicList.result.results.map((_) => ({
        id: _.songId,
        artwork: formatImgUrl(_.picL),
        title: _.songName,
        artist: (_.singerName || []).join(", "),
        album: _.albumName,
        url: musicCanPlayFilter(_),
        rawLrc: _.lyricLrc,
        copyrightId: _.copyrightId,
        singerId: _.singerId,
        qualities: getMiGuQualitiesFromSong(_), // 添加音质检测
      })),
    };
  } else if (type === "album") {
    return getArtistAlbumWorks(artistItem, page);
  }
}
// 咪咕 MRC 解密和解析函数
const { Buffer } = require('buffer');
const pako = require('pako');

// MRC 解密密钥
const MRC_KEY = Buffer.from([
  0x40, 0x47, 0x61, 0x77, 0x5E, 0x32, 0x74, 0x47,
  0x51, 0x36, 0x31, 0x2D, 0xCE, 0xD2, 0x6E, 0x69
]);

function decryptMrc(base64Content) {
  try {
    const encrypted = Buffer.from(base64Content, 'base64');
    const decrypted = Buffer.alloc(encrypted.length);

    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ MRC_KEY[i % MRC_KEY.length];
    }

    return decrypted.toString('utf-8');
  } catch (error) {
    console.error('[咪咕] MRC解密失败:', error);
    return null;
  }
}

function parseMrc(mrcContent) {
  try {
    const lines = mrcContent.split(/\r\n|\r|\n/);
    const lrcLines = [];

    for (const line of lines) {
      const match = line.match(/^\s*\[(\d+),\d+\]/);
      if (match) {
        const startTime = parseInt(match[1]);
        let ms = startTime % 1000;
        let totalSeconds = Math.floor(startTime / 1000);
        let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        let s = (totalSeconds % 60).toString().padStart(2, '0');
        const timeTag = `[${m}:${s}.${ms}]`;
        const words = line.replace(/^\s*\[\d+,\d+\]/, '').replace(/\(\d+,\d+\)/g, '');
        lrcLines.push(`${timeTag}${words}`);
      }
    }

    return lrcLines.join('\n');
  } catch (error) {
    console.error('[咪咕] MRC解析失败:', error);
    return null;
  }
}

async function getMiGuMusicInfo(copyrightId) {
  try {
    const res = await axios_1.default.post(
      'https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=2',
      `resourceId=${copyrightId}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36',
          'Referer': 'https://m.music.migu.cn/',
        },
      }
    );

    if (res.data && res.data.resource && res.data.resource.length > 0) {
      return res.data.resource[0];
    }
    return null;
  } catch (error) {
    console.error('[咪咕] 获取歌曲信息失败:', error);
    return null;
  }
}

async function fetchText(url) {
  if (!url) return '';
  try {
    const res = await axios_1.default.get(url, {
      headers: {
        'Referer': 'https://app.c.nf.migu.cn/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E)',
      },
    });
    return res.data || '';
  } catch (error) {
    console.error('[咪咕] 获取文本失败:', error);
    return '';
  }
}

async function getLyric(musicItem) {
  try {
    // 获取歌曲详细信息（包含歌词URL）
    const musicInfo = await getMiGuMusicInfo(musicItem.copyrightId);

    if (!musicInfo) {
      // 降级到原有API
      const headers = {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        Connection: "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Host: "m.music.migu.cn",
        Referer: `https://m.music.migu.cn/migu/l/?s=149&p=163&c=5200&j=l&id=${musicItem.copyrightId}`,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
        "X-Requested-With": "XMLHttpRequest",
      };
      const result = (
        await axios_1.default.get(
          "https://m.music.migu.cn/migu/remoting/cms_detail_tag",
          {
            headers,
            params: {
              cpid: musicItem.copyrightId,
            },
          }
        )
      ).data;
      return {
        rawLrc: result.data.lyricLrc,
      };
    }

    // 并行获取原文和译文
    let lyricPromise;

    // 优先使用 MRC，其次 LRC
    if (musicInfo.mrcUrl) {
      lyricPromise = fetchText(musicInfo.mrcUrl).then(content => {
        const decrypted = decryptMrc(content);
        if (decrypted) {
          const parsed = parseMrc(decrypted);
          if (parsed) return parsed;
        }
        return null;
      });
    } else if (musicInfo.lrcUrl) {
      lyricPromise = fetchText(musicInfo.lrcUrl);
    }

    // 获取译文
    const translationPromise = musicInfo.trcUrl
      ? fetchText(musicInfo.trcUrl)
      : Promise.resolve('');

    if (!lyricPromise) {
      return { rawLrc: '' };
    }

    const [lyric, translation] = await Promise.all([lyricPromise, translationPromise]);

    if (!lyric) {
      return { rawLrc: '' };
    }

    return {
      rawLrc: lyric,
      translation: translation || undefined,
    };
  } catch (error) {
    console.error('[咪咕] 获取歌词失败:', error);
    return { rawLrc: '' };
  }
}
async function getMusicSheetInfo(sheet, page) {
  try {
    // 处理歌单ID
    let sheetId = sheet.id || sheet;
    
    // 使用ikun-music-mobile的API获取歌单信息（MIGUM2.0）
    try {
      const url = `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${sheetId}&pageNo=${page}&pageSize=30`;
      
      const res = await axios_1.default.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
          Referer: 'https://m.music.migu.cn/',
        },
      });
      
      if (res.data && res.data.code === '000000' && res.data.list) {
        const musicList = res.data.list.map((item) => {
          const qualities = {};
          
          // 解析newRateFormats获取音质信息（与ikun-music-mobile一致）
          if (item.newRateFormats && Array.isArray(item.newRateFormats)) {
            item.newRateFormats.forEach((format) => {
              const size = format.size || format.androidSize || format.fileSize;
              
              switch (format.formatType) {
                case 'PQ': // 标准音质 128k
                  qualities['128k'] = {
                    size: sizeFormate(size),
                    bitrate: format.bitRate || 128000,
                  };
                  break;
                case 'HQ': // 高音质 320k
                  qualities['320k'] = {
                    size: sizeFormate(size),
                    bitrate: format.bitRate || 320000,
                  };
                  break;
                case 'SQ': // 无损音质 flac
                  qualities['flac'] = {
                    size: sizeFormate(size),
                    bitrate: format.bitRate || 1411000,
                  };
                  break;
                case 'ZQ': // Hi-Res音质
                case 'ZQ24':
                  qualities['hires'] = {
                    size: sizeFormate(size),
                    bitrate: format.bitRate || 2304000,
                  };
                  break;
              }
            });
          }
          
          // 如果没有newRateFormats，尝试从其他字段获取
          if (Object.keys(qualities).length === 0 && item.rateFormats) {
            const formats = item.rateFormats.split('|');
            formats.forEach((format) => {
              switch (format) {
                case 'PQ':
                  qualities['128k'] = { size: 'N/A', bitrate: 128000 };
                  break;
                case 'HQ':
                  qualities['320k'] = { size: 'N/A', bitrate: 320000 };
                  break;
                case 'SQ':
                  qualities['flac'] = { size: 'N/A', bitrate: 1411000 };
                  break;
                case 'ZQ':
                case 'ZQ24':
                  qualities['hires'] = { size: 'N/A', bitrate: 2304000 };
                  break;
              }
            });
          }
          
          // 确保至少有基础音质
          if (Object.keys(qualities).length === 0) {
            qualities['128k'] = { size: 'N/A', bitrate: 128000 };
          }
          
          // 处理歌手信息
          let artist = '';
          if (item.artists && Array.isArray(item.artists)) {
            artist = item.artists.map(a => a.name || a.artistName || '').filter(Boolean).join(', ');
          } else if (item.singer) {
            artist = item.singer;
          } else if (item.singerName) {
            artist = Array.isArray(item.singerName) ? item.singerName.join(', ') : item.singerName;
          }
          
          // 处理封面图片
          let artwork = null;
          if (item.albumImgs && item.albumImgs.length > 0) {
            artwork = formatImgUrl(item.albumImgs[0].img);
          } else {
            artwork = formatImgUrl(item.albumPic || item.img3 || item.img2 || item.img1);
          }

          return {
            id: item.songId || item.id,
            artwork: artwork,
            title: item.songName || item.name,
            artist: artist,
            album: item.album || item.albumName,
            copyrightId: item.copyrightId,
            singerId: item.singerId,
            qualities: qualities,
          };
        });
        
        return {
          isEnd: res.data.totalCount <= page * 30,
          musicList: musicList,
        };
      }
    } catch (err) {
      console.log('[咪咕] MIGUM2.0 API获取歌单失败，尝试备用API:', err.message);
    }
    
    // 如果MIGUM2.0失败，尝试使用MIGUM3.0 API
    try {
      const time = Date.now().toString();
      const signData = createSignature(time, sheetId);
      
      const headers = {
        uiVersion: 'A_music_3.6.1',
        deviceId: signData.deviceId,
        timestamp: time,
        sign: signData.sign,
        channel: '0146921',
        'User-Agent':
          'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
      };
      
      const url = `https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/v2.0?playlistId=${sheetId}&pageNo=${page}&pageSize=30`;
      const res = await axios_1.default.get(url, { headers });
      
      if (res.data && res.data.resource && res.data.resource.length > 0) {
        const musicList = res.data.resource.map((item) => {
          const qualities = {};
          
          // 解析newRateFormats获取音质信息
          if (item.newRateFormats && Array.isArray(item.newRateFormats)) {
            item.newRateFormats.forEach((format) => {
              const formatInfo = format.split('|');
              if (formatInfo.length >= 4) {
                const formatType = formatInfo[0];
                const fileSize = parseInt(formatInfo[3]) || 0;
                const bitRate = parseInt(formatInfo[2]) || 0;
                
                switch (formatType) {
                  case 'PQ':
                    qualities['128k'] = {
                      size: sizeFormate(fileSize),
                      bitrate: bitRate || 128000,
                    };
                    break;
                  case 'HQ':
                    qualities['320k'] = {
                      size: sizeFormate(fileSize),
                      bitrate: bitRate || 320000,
                    };
                    break;
                  case 'SQ':
                    qualities['flac'] = {
                      size: sizeFormate(fileSize),
                      bitrate: bitRate || 1411000,
                    };
                    break;
                  case 'ZQ':
                  case 'ZQ24':
                    qualities['hires'] = {
                      size: sizeFormate(fileSize),
                      bitrate: bitRate || 2304000,
                    };
                    break;
                }
              }
            });
          }
          
          // 确保至少有基础音质
          if (Object.keys(qualities).length === 0) {
            qualities['128k'] = { size: 'N/A', bitrate: 128000 };
          }
          
          return {
            id: item.songId || item.copyrightId || item.id,
            artwork: formatImgUrl(
              item.albumImgs && item.albumImgs.length > 0
                ? item.albumImgs[0].img
                : (item.img3 || item.img2 || item.img1 || item.cover)
            ),
            title: item.songName || item.name,
            artist: item.singer || formatSingerName(item.singers),
            album: item.album || item.albumName,
            copyrightId: item.copyrightId,
            singerId: item.singerId,
            qualities: qualities,
          };
        });
        
        return {
          isEnd: res.data.totalCount <= page * 30,
          musicList: musicList,
        };
      }
    } catch (err) {
      console.log('[咪咕] MIGUM3.0 API也失败了，使用降级方案:', err.message);
    }
    
    // 如果两个API都失败，使用最基础的H5 API作为降级方案
    const res = (
      await axios_1.default.get(
        "https://m.music.migu.cn/migumusic/h5/playlist/songsInfo",
        {
          params: {
            palylistId: sheetId,
            pageNo: page,
            pageSize: 30,
          },
          headers: {
            Host: "m.music.migu.cn",
            referer: "https://m.music.migu.cn/v4/music/playlist/",
            By: "7242bd16f68cd9b39c54a8e61537009f",
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/113.0.0.0",
          },
        }
      )
    ).data.data;
    
    if (!res) {
      return {
        isEnd: true,
        musicList: [],
      };
    }
    
    const isEnd = res.total < 30;
    return {
      isEnd,
      musicList: res.items
        .filter((item) => {
          var _a;
          return (
            ((_a = item === null || item === void 0 ? void 0 : item.fullSong) ===
              null || _a === void 0
              ? void 0
              : _a.vipFlag) === 0
          );
        })
        .map((_) => {
          var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
          
          // 使用getMiGuQualitiesFromSong函数获取音质
          const qualities = getMiGuQualitiesFromSong(_);
          
          return {
            id: _.id,
            artwork: formatImgUrl(_.mediumPic),
            title: _.name,
            artist:
              (_f =
                (_e =
                  (_d =
                    (_c =
                      (_b = _.singers) === null || _b === void 0
                        ? void 0
                        : _b.map) === null || _c === void 0
                      ? void 0
                      : _c.call(_b, (_) => _.name)) === null || _d === void 0
                    ? void 0
                    : _d.join) === null || _e === void 0
                  ? void 0
                  : _e.call(_d, ",")) !== null && _f !== void 0
                ? _f
                : "",
            album:
              (_h =
                (_g = _.album) === null || _g === void 0
                  ? void 0
                  : _g.albumName) !== null && _h !== void 0
                ? _h
                : "",
            copyrightId: _.copyrightId,
            singerId:
              (_k =
                (_j = _.singers) === null || _j === void 0 ? void 0 : _j[0]) ===
                null || _k === void 0
                ? void 0
                : _k.id,
            qualities: qualities,
          };
        }),
    };
  } catch (error) {
    console.error('[咪咕] 获取歌单信息失败:', error);
    return {
      isEnd: true,
      musicList: [],
    };
  }
}
async function importMusicSheet(urlLike) {
  var _a, _b, _c, _d;
  let id;
  if (!id) {
    id = (urlLike.match(
      /https?:\/\/music\.migu\.cn\/v3\/(?:my|music)\/playlist\/([0-9]+)/
    ) || [])[1];
  }
  if (!id) {
    id = (urlLike.match(
      /https?:\/\/h5\.nf\.migu\.cn\/app\/v4\/p\/share\/playlist\/index.html\?.*id=([0-9]+)/
    ) || [])[1];
  }
  if (!id) {
    id =
      (_a = urlLike.match(/^\s*(\d+)\s*$/)) === null || _a === void 0
        ? void 0
        : _a[1];
  }
  if (!id) {
    const tempUrl =
      (_b = urlLike.match(/(https?:\/\/c\.migu\.cn\/[\S]+)\?/)) === null ||
      _b === void 0
        ? void 0
        : _b[1];
    if (tempUrl) {
      const request = (
        await axios_1.default.get(tempUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.61",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            host: "c.migu.cn",
          },
          validateStatus(status) {
            return (status >= 200 && status < 300) || status === 403;
          },
        })
      ).request;
      const realpath =
        (_c =
          request === null || request === void 0 ? void 0 : request.path) !==
          null && _c !== void 0
          ? _c
          : request === null || request === void 0
          ? void 0
          : request.responseURL;
      if (realpath) {
        id =
          (_d = realpath.match(/id=(\d+)/)) === null || _d === void 0
            ? void 0
            : _d[1];
      }
    }
  }
  if (!id) {
    return;
  }
  const headers = {
    host: "m.music.migu.cn",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://m.music.migu.cn",
  };
  const res = (
    await axios_1.default.get(
      `https://m.music.migu.cn/migu/remoting/query_playlist_by_id_tag?onLine=1&queryChannel=0&createUserId=migu&contentCountMin=5&playListId=${id}`,
      {
        headers,
      }
    )
  ).data;
  const contentCount = parseInt(res.rsp.playList[0].contentCount);
  const cids = [];
  let pageNo = 1;
  while ((pageNo - 1) * 20 < contentCount) {
    const listPage = (
      await axios_1.default.get(
        `https://music.migu.cn/v3/music/playlist/${id}?page=${pageNo}`
      )
    ).data;
    const $ = (0, cheerio_1.load)(listPage);
    $(".row.J_CopySong").each((i, v) => {
      cids.push($(v).attr("data-cid"));
    });
    pageNo += 1;
  }
  if (cids.length === 0) {
    return;
  }
  const songs = (
    await (0, axios_1.default)({
      url: `https://music.migu.cn/v3/api/music/audioPlayer/songs?type=1&copyrightId=${cids.join(
        ","
      )}`,
      headers: {
        referer: "http://m.music.migu.cn/v3",
      },
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  return songs.items
    .filter((_) => _.vipFlag === 0)
    .map((_) => {
      var _a, _b, _c, _d, _e, _f;
      return {
        id: _.songId,
        artwork: formatImgUrl(_.picL || _.picM || _.picS || _.cover || _.songPic),
        title: _.songName,
        artist:
          (_b =
            (_a = _.singers) === null || _a === void 0
              ? void 0
              : _a.map((_) => _.artistName)) === null || _b === void 0
            ? void 0
            : _b.join(", "),
        album:
          (_d = (_c = _.albums) === null || _c === void 0 ? void 0 : _c[0]) ===
            null || _d === void 0
            ? void 0
            : _d.albumName,
        copyrightId: _.copyrightId,
        singerId:
          (_f = (_e = _.singers) === null || _e === void 0 ? void 0 : _e[0]) ===
            null || _f === void 0
            ? void 0
            : _f.artistId,
        qualities: getMiGuQualitiesFromSong(_), // 添加音质检测
      };
    });
}
async function getTopLists() {
  const jianjiao = {
    title: "咪咕尖叫榜",
    data: [
      {
        id: "jianjiao_newsong",
        title: "尖叫新歌榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/02/36/20020512065402_360x360_2997.png",
      },
      {
        id: "jianjiao_hotsong",
        title: "尖叫热歌榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/04/99/200408163640868_360x360_6587.png",
      },
      {
        id: "jianjiao_original",
        title: "尖叫原创榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/04/99/200408163702795_360x360_1614.png",
      },
    ],
  };
  const tese = {
    title: "咪咕特色榜",
    data: [
      {
        id: "movies",
        title: "影视榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/05/136/200515161848938_360x360_673.png",
      },
      {
        id: "mainland",
        title: "内地榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095104122_327x327_4971.png",
      },
      {
        id: "hktw",
        title: "港台榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095125191_327x327_2382.png",
      },
      {
        id: "eur_usa",
        title: "欧美榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095229556_327x327_1383.png",
      },
      {
        id: "jpn_kor",
        title: "日韩榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095259569_327x327_4628.png",
      },
      {
        id: "coloring",
        title: "彩铃榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095356693_327x327_7955.png",
      },
      {
        id: "ktv",
        title: "KTV榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095414420_327x327_4992.png",
      },
      {
        id: "network",
        title: "网络榜",
        coverImg:
          "https://cdnmusic.migu.cn/tycms_picture/20/08/231/200818095442606_327x327_1298.png",
      },
    ],
  };
  return [jianjiao, tese];
}
const UA =
  "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68";
const By = CryptoJS.MD5(UA).toString();
async function getTopListDetail(topListItem) {
  const res = await axios_1.default.get(
    `https://m.music.migu.cn/migumusic/h5/billboard/home`,
    {
      params: {
        pathName: topListItem.id,
        pageNum: 1,
        pageSize: 100,
      },
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        Host: "m.music.migu.cn",
        referer: `https://m.music.migu.cn/v4/music/top/${topListItem.id}`,
        "User-Agent": UA,
        By,
      },
    }
  );
  return Object.assign(Object.assign({}, topListItem), {
    musicList: res.data.data.songs.items.map((_) => {
      var _a, _b, _c, _d, _e, _f;
      return {
        id: _.id,
        artwork: formatImgUrl(_.mediumPic),
        title: _.name,
        artist:
          (_c =
            (_b = _.singers) === null || _b === void 0
              ? void 0
              : _b.map((_) => _.name)) === null || _c === void 0
            ? void 0
            : _c.join(", "),
        album: (_d = _.album) === null || _d === void 0 ? void 0 : _d.albumName,
        copyrightId: _.copyrightId,
        singerId:
          (_f = (_e = _.singers) === null || _e === void 0 ? void 0 : _e[0]) ===
            null || _f === void 0
            ? void 0
            : _f.id,
        qualities: getMiGuQualitiesFromSong(_), // 添加音质检测
      };
    }),
  });
}
async function getRecommendSheetTags() {
  const allTags = (
    await axios_1.default.get(
      "https://m.music.migu.cn/migumusic/h5/playlist/allTag",
      {
        headers: {
          host: "m.music.migu.cn",
          referer: "https://m.music.migu.cn/v4/music/playlist",
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/113.0.0.0",
          By: "7242bd16f68cd9b39c54a8e61537009f",
        },
      }
    )
  ).data.data.tags;
  const data = allTags.map((_) => {
    return {
      title: _.tagName,
      data: _.tags.map((_) => ({
        id: _.tagId,
        title: _.tagName,
      })),
    };
  });
  return {
    pinned: [
      {
        title: "小清新",
        id: "1000587673",
      },
      {
        title: "电视剧",
        id: "1001076078",
      },
      {
        title: "民谣",
        id: "1000001775",
      },
      {
        title: "旅行",
        id: "1000001749",
      },
      {
        title: "思念",
        id: "1000001703",
      },
    ],
    data,
  };
}
async function getRecommendSheetsByTag(sheetItem, page) {
  const pageSize = 20;
  const res = (
    await axios_1.default.get(
      "https://m.music.migu.cn/migumusic/h5/playlist/list",
      {
        params: {
          columnId: 15127272,
          tagId: sheetItem.id,
          pageNum: page,
          pageSize,
        },
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1 Edg/113.0.0.0",
          host: "m.music.migu.cn",
          By: "7242bd16f68cd9b39c54a8e61537009f",
          Referer: "https://m.music.migu.cn/v4/music/playlist",
        },
      }
    )
  ).data.data;
  const isEnd = page * pageSize > res.total;
  const data = res.items.map((_) => ({
    id: _.playListId,
    artist: _.createUserName,
    title: _.playListName,
    artwork: formatImgUrl(_.image),
    playCount: _.playCount,
    createUserId: _.createUserId,
  }));
  return {
    isEnd,
    data,
  };
}
const qualityLevels = {
  "128k": "128k",
  "320k": "320k",
  "flac": "flac",
  "hires": "hires",
};
async function getMediaSource(musicItem, quality) {
  try {
    // 检查音质信息
    if (musicItem.qualities && Object.keys(musicItem.qualities).length > 0) {
      // 如果歌曲不支持请求的音质，返回错误
      if (!musicItem.qualities[quality]) {
        console.error(`[咪咕] 歌曲不支持音质 ${quality}`);
        throw new Error(`该歌曲不支持 ${quality} 音质`);
      }
    }
    
    const res = (
      await axios_1.default.get(
        `${API_URL}/url?source=mg&songId=${musicItem.copyrightId}&quality=${qualityLevels[quality]}`,
        {
          headers: {
            "X-Request-Key": API_KEY,
            "User-Agent": "MusicFree/2.0.0"
          },
          "timeout": 10000
        }
      )
    ).data;
    
    if (res.code === 200 && res.url) {
      return {
        url: res.url
      };
    } else {
      console.error(`[咪咕] 获取播放链接失败: ${res.msg || '未知错误'}`);
      return null;
    }
  } catch (error) {
    console.error(`[咪咕] 获取播放源错误: ${error.message}`);
    throw error;
  }
}
async function getMusicComments(musicItem, page = 1) {
  const pageSize = 20;

  try {
    // 使用简化的API，直接使用songId作为targetId
    const targetId = musicItem.id || musicItem.copyrightId;

    const res = await axios_1.default.get(
      `https://music.migu.cn/v3/api/comment/listComments`,
      {
        params: {
          targetId: targetId,
          pageSize: pageSize,
          pageNo: page,
        },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4195.1 Safari/537.36',
          Referer: 'https://music.migu.cn',
        },
      }
    );

    if (res.status !== 200 || res.data.returnCode !== '000000') {
      return { isEnd: true, data: [] };
    }

    const comments = (res.data.data?.items || []).map((item) => ({
      id: item.commentId?.toString(),
      nickName: item.author?.name || '',
      avatar: item.author?.avatar?.startsWith('//')
        ? `http:${item.author.avatar}`
        : item.author?.avatar,
      comment: item.body || '',
      like: item.praiseCount,
      createAt: item.createTime ? new Date(item.createTime).getTime() : null,
      replies: (item.replyCommentList || []).map((c) => ({
        id: c.commentId?.toString(),
        nickName: c.author?.name || '',
        avatar: c.author?.avatar?.startsWith('//')
          ? `http:${c.author.avatar}`
          : c.author?.avatar,
        comment: c.body || '',
        like: c.praiseCount,
        createAt: c.createTime ? new Date(c.createTime).getTime() : null,
      })),
    }));

    const total = res.data.data?.itemTotal || 0;

    return {
      isEnd: page * pageSize >= total,
      data: comments,
    };
  } catch (error) {
    console.error('[咪咕] 获取评论失败:', error);
    return { isEnd: true, data: [] };
  }
}
module.exports = {
  platform: "咪咕音乐",
  author: "Toskysun",
  version: "0.2.0",
  appVersion: ">0.1.0-alpha.0",
  // 声明插件支持的音质列表（基于咪咕音乐实际提供的音质）
  supportedQualities: ["128k", "320k", "flac", "hires"],
  hints: {
    importMusicSheet: [
      "咪咕APP：自建歌单-分享-复制链接，直接粘贴即可",
      "H5/PC端：复制URL并粘贴，或者直接输入纯数字歌单ID即可",
      "导入时间和歌单大小有关，请耐心等待",
    ],
  },
  primaryKey: ["copyrightId"],
  cacheControl: "cache",
  srcUrl: UPDATE_URL,
  supportedSearchType: ["music", "album", "sheet", "artist", "lyric"],
  getMediaSource,
  async search(query, page, type) {
    if (type === "music") {
      return await searchMusic(query, page);
    }
    if (type === "album") {
      return await searchAlbum(query, page);
    }
    if (type === "artist") {
      return await searchArtist(query, page);
    }
    if (type === "sheet") {
      return await searchMusicSheet(query, page);
    }
    if (type === "lyric") {
      return await searchLyric(query, page);
    }
  },
  async getAlbumInfo(albumItem) {
    const headers = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      Connection: "keep-alive",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Host: "m.music.migu.cn",
      Referer: `https://m.music.migu.cn/migu/l/?record=record&id=${albumItem.id}`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
      "X-Requested-With": "XMLHttpRequest",
    };
    const musicList =
      (
        await axios_1.default.get(
          "https://m.music.migu.cn/migu/remoting/cms_album_song_list_tag",
          {
            headers,
            params: {
              albumId: albumItem.id,
              pageSize: 30,
            },
          }
        )
      ).data || {};
    const albumDesc =
      (
        await axios_1.default.get(
          "https://m.music.migu.cn/migu/remoting/cms_album_detail_tag",
          {
            headers,
            params: {
              albumId: albumItem.id,
            },
          }
        )
      ).data || {};
    return {
      albumItem: { description: albumDesc.albumIntro },
      musicList: musicList.result.results.map((_) => ({
        id: _.songId,
        artwork: formatImgUrl(_.picL),
        title: _.songName,
        artist: (_.singerName || []).join(", "),
        album: albumItem.title,
        url: musicCanPlayFilter(_),
        rawLrc: _.lyricLrc,
        copyrightId: _.copyrightId,
        singerId: _.singerId,
        qualities: getMiGuQualitiesFromSong(_), // 添加音质检测
      })),
    };
  },
  getArtistWorks: getArtistWorks,
  getLyric: getLyric,
  importMusicSheet,
  getTopLists,
  getTopListDetail,
  getRecommendSheetTags,
  getRecommendSheetsByTag,
  getMusicSheetInfo,
  getMusicComments,
};
