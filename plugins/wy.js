const API_URL = "{{API_URL}}";
const API_KEY = "{{API_KEY}}";
const UPDATE_URL = "{{UPDATE_URL}}";

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const CryptoJs = require("crypto-js");
const qs = require("qs");
const bigInt = require("big-integer");
const dayjs = require("dayjs");
const cheerio = require("cheerio");
function create_key() {
  var d,
    e,
    b = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    c = "";
  for (d = 0; 16 > d; d += 1)
    (e = Math.random() * b.length), (e = Math.floor(e)), (c += b.charAt(e));
  return c;
}
function AES(a, b) {
  var c = CryptoJs.enc.Utf8.parse(b),
    d = CryptoJs.enc.Utf8.parse("0102030405060708"),
    e = CryptoJs.enc.Utf8.parse(a),
    f = CryptoJs.AES.encrypt(e, c, {
      iv: d,
      mode: CryptoJs.mode.CBC,
    });
  return f.toString();
}
function Rsa(text) {
  text = text.split("").reverse().join("");
  const d = "010001";
  const e =
    "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
  const hexText = text
    .split("")
    .map((_) => _.charCodeAt(0).toString(16))
    .join("");
  const res = bigInt(hexText, 16)
    .modPow(bigInt(d, 16), bigInt(e, 16))
    .toString(16);
  return Array(256 - res.length)
    .fill("0")
    .join("")
    .concat(res);
}
function getParamsAndEnc(text) {
  const first = AES(text, "0CoJUm6Qyw8W8jud");
  const rand = create_key();
  const params = AES(first, rand);
  const encSecKey = Rsa(rand);
  return {
    params,
    encSecKey,
  };
}
// 获取网易云音乐的音质详细信息
function sizeFormate(size) {
  // 转换字节为可读格式
  if (size < 1024) return size + 'B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + 'KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + 'MB';
  return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
}

async function getMusicQualityInfo(id) {
  try {
    const res = await axios_1.default.get(
      `https://music.163.com/api/song/music/detail/get?songId=${id}`,
      {
        headers: {
          referer: "https://music.163.com/",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        },
      }
    );
    
    if (res.status !== 200 || res.data.code !== 200) {
      console.error(`[网易云] 获取音质信息失败`);
      return {};
    }
    
    const data = res.data.data;
    const qualities = {};
    
    // 128k (l或m)
    if (data.l && data.l.size) {
      qualities['128k'] = {
        size: sizeFormate(data.l.size),
        bitrate: data.l.br || 128000,
      };
    } else if (data.m && data.m.size) {
      qualities['128k'] = {
        size: sizeFormate(data.m.size),
        bitrate: data.m.br || 128000,
      };
    }
    
    // 320k (h)
    if (data.h && data.h.size) {
      qualities['320k'] = {
        size: sizeFormate(data.h.size),
        bitrate: data.h.br || 320000,
      };
    }
    
    // flac (sq)
    if (data.sq && data.sq.size) {
      qualities['flac'] = {
        size: sizeFormate(data.sq.size),
        bitrate: data.sq.br || 1411000,
      };
    }
    
    // hires (hr)
    if (data.hr && data.hr.size) {
      qualities['hires'] = {
        size: sizeFormate(data.hr.size),
        bitrate: data.hr.br || 2304000,
      };
    }
    
    // master (jm)
    if (data.jm && data.jm.size) {
      qualities['master'] = {
        size: sizeFormate(data.jm.size),
        bitrate: data.jm.br || 4608000,
      };
    }
    
    // atmos (je)
    if (data.je && data.je.size) {
      qualities['atmos'] = {
        size: sizeFormate(data.je.size),
        bitrate: data.je.br || 1411000,
      };
    }
    
    return qualities;
  } catch (error) {
    console.error(`[网易云] 获取音质信息异常:`, error.message);
    return {};
  }
}

// 批量获取音质信息
async function getBatchMusicQualityInfo(idList) {
  if (!idList || idList.length === 0) return {};
  
  const qualityPromises = idList.map(id => 
    getMusicQualityInfo(id).catch(err => {
      console.error(`获取歌曲 ${id} 音质信息失败:`, err);
      return {};
    })
  );
  
  const qualityResults = await Promise.all(qualityPromises);
  
  const qualityInfoMap = {};
  idList.forEach((id, index) => {
    qualityInfoMap[id] = qualityResults[index] || {};
  });
  
  return qualityInfoMap;
}

function formatMusicItem(_) {
  var _a, _b, _c, _d;
  const album = _.al || _.album;
  
  // 构建符合MusicFree标准的音质对象，基于实际可用的音质数据
  const qualities = {};
  
  // 网易云API中，privilege字段包含音质信息
  if (_.privilege) {
    // 基于privilege字段中的maxbr判断支持的音质
    const maxBr = _.privilege.maxbr || _.privilege.maxBrLevel;
    const fee = _.privilege.fee;
    
    // 根据最大码率判断可用音质
    if (maxBr) {
      // 128k
      if (maxBr >= 128000) {
        qualities['128k'] = {
          bitrate: 128000,
        };
      }
      // 320k
      if (maxBr >= 320000) {
        qualities['320k'] = {
          bitrate: 320000,
        };
      }
      // flac
      if (maxBr >= 999000) {
        qualities['flac'] = {
          bitrate: 1411000,
        };
      }
      // hires
      if (maxBr >= 1999000) {
        qualities['hires'] = {
          bitrate: 2304000,
        };
      }
    }
  }
  
  // 如果有详细的音质字段（通常在获取歌曲详情时），使用更精确的信息
  // 低音质 (l/m) -> 128k  (优先使用l，如果没有则使用m)
  if ((_.l && _.l.size) || (_.m && _.m.size && !_.h)) {
    const audioData = _.l || _.m;
    qualities['128k'] = {
      size: audioData.size,
      bitrate: audioData.br || 128000,
    };
  }
  
  // 中音质 (h) -> 320k
  if (_.h && _.h.size) {
    qualities['320k'] = {
      size: _.h.size,
      bitrate: _.h.br || 320000,
    };
  }
  
  // 超高音质 (sq) -> flac
  if (_.sq && _.sq.size) {
    qualities['flac'] = {
      size: _.sq.size,
      bitrate: _.sq.br || 1411000,
    };
  }
  
  // Hi-Res音质 (hr) -> hires  
  if (_.hr && _.hr.size) {
    qualities['hires'] = {
      size: _.hr.size,
      bitrate: _.hr.br || 2304000,
    };
  }
  
  // 臻品母带音质 (jm) -> master
  if (_.jm && _.jm.size) {
    qualities['master'] = {
      size: _.jm.size,
      bitrate: _.jm.br,
    };
  }
  
  // 沉浸环绕声 (je) -> atmos
  if (_.je && _.je.size) {
    qualities['atmos'] = {
      size: _.je.size,
      bitrate: _.je.br,
    };
  }
  
  // 如果没有任何音质信息，提供默认的基础音质
  if (Object.keys(qualities).length === 0) {
    qualities['128k'] = { bitrate: 128000 };
    qualities['320k'] = { bitrate: 320000 };
  }
  
  return {
    id: _.id,
    artwork: album === null || album === void 0 ? void 0 : album.picUrl,
    title: _.name,
    artist: (_.ar || _.artists)[0].name,
    album: album === null || album === void 0 ? void 0 : album.name,
    albumId: album === null || album === void 0 ? void 0 : album.id,
    url: `https://share.duanx.cn/url/wy/${_.id}/128k`,
    qualities: qualities,
    copyrightId: _ === null || _ === void 0 ? void 0 : _.copyrightId,
    privilege: _.privilege,
  };
}

// 带音质信息的格式化函数
async function formatMusicItemWithQuality(_, qualityInfo = {}) {
  const album = _.al || _.album;
  const qualities = qualityInfo || {};
  
  return {
    id: _.id,
    artwork: album === null || album === void 0 ? void 0 : album.picUrl,
    title: _.name,
    artist: (_.ar || _.artists)[0].name,
    album: album === null || album === void 0 ? void 0 : album.name,
    albumId: album === null || album === void 0 ? void 0 : album.id,
    url: `https://share.duanx.cn/url/wy/${_.id}/128k`,
    qualities: qualities,
    copyrightId: _ === null || _ === void 0 ? void 0 : _.copyrightId,
    privilege: _.privilege,
  };
}
function formatAlbumItem(_) {
  return {
    id: _.id,
    artist: _.artist.name,
    title: _.name,
    artwork: _.picUrl,
    description: "",
    date: dayjs.unix(_.publishTime / 1000).format("YYYY-MM-DD"),
  };
}
const pageSize = 30;
async function searchBase(query, page, type) {
  const data = {
    s: query,
    limit: pageSize,
    type: type,
    offset: (page - 1) * pageSize,
    csrf_token: "",
  };
  const pae = getParamsAndEnc(JSON.stringify(data));
  const paeData = qs.stringify(pae);
  const headers = {
    authority: "music.163.com",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "content-type": "application/x-www-form-urlencoded",
    accept: "*/*",
    origin: "https://music.163.com",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    referer: "https://music.163.com/search/",
    "accept-language": "zh-CN,zh;q=0.9",
  };
  const res = (
    await (0, axios_1.default)({
      method: "post",
      url: "https://music.163.com/weapi/search/get",
      headers,
      data: paeData,
    })
  ).data;
  return res;
}
async function searchMusic(query, page) {
  const res = await searchBase(query, page, 1);

  // 获取所有歌曲ID
  const songIds = (res.result.songs || []).map(song => song.id);

  let formattedSongs = [];
  if (songIds.length > 0) {
    try {
      // 使用 getValidMusicItems 批量获取完整的歌曲详情，确保封面等字段完整
      formattedSongs = await getValidMusicItems(songIds);
    } catch (error) {
      console.error('[网易云] 批量获取搜索歌曲详情失败:', error);
      // 如果批量获取失败，降级使用原始数据
      formattedSongs = (res.result.songs || []).map(formatMusicItem);
    }
  }

  return {
    isEnd: res.result.songCount <= page * pageSize,
    data: formattedSongs,
  };
}
async function searchAlbum(query, page) {
  const res = await searchBase(query, page, 10);
  const albums = res.result.albums.map(formatAlbumItem);
  return {
    isEnd: res.result.albumCount <= page * pageSize,
    data: albums,
  };
}
async function searchArtist(query, page) {
  const res = await searchBase(query, page, 100);
  const artists = res.result.artists.map((_) => ({
    name: _.name,
    id: _.id,
    avatar: _.img1v1Url,
    worksNum: _.albumSize,
  }));
  return {
    isEnd: res.result.artistCount <= page * pageSize,
    data: artists,
  };
}
async function searchMusicSheet(query, page) {
  const res = await searchBase(query, page, 1000);
  const playlists = res.result.playlists.map((_) => {
    var _a;
    return {
      title: _.name,
      id: _.id,
      coverImg: _.coverImgUrl,
      artist: (_a = _.creator) === null || _a === void 0 ? void 0 : _a.nickname,
      playCount: _.playCount,
      worksNum: _.trackCount,
    };
  });
  return {
    isEnd: res.result.playlistCount <= page * pageSize,
    data: playlists,
  };
}
async function searchLyric(query, page) {
  var _a, _b;
  // 使用类型1搜索歌曲，然后提供歌词ID
  const res = await searchBase(query, page, 1);

  // 获取所有歌曲ID，批量获取完整的歌曲信息（包括封面）
  const songIds = (res.result.songs || []).map(song => song.id);

  let formattedSongs = [];
  if (songIds.length > 0) {
    try {
      // 使用 getValidMusicItems 批量获取完整的歌曲详情，确保封面等字段完整
      formattedSongs = await getValidMusicItems(songIds);
    } catch (error) {
      console.error('[网易云] 批量获取歌词搜索歌曲详情失败:', error);
      // 如果批量获取失败，降级使用原始数据
      formattedSongs = (res.result.songs || []).map(formatMusicItem);
    }
  }

  // 为歌词搜索结果添加 platform 字段
  const lyrics = formattedSongs.map(item => ({
    ...item,
    platform: "网易云音乐",
  }));

  return {
    isEnd: res.result.songCount <= page * pageSize,
    data: lyrics,
  };
}
async function getArtistWorks(artistItem, page, type) {
  const data = {
    csrf_token: "",
  };
  const pae = getParamsAndEnc(JSON.stringify(data));
  const paeData = qs.stringify(pae);
  const headers = {
    authority: "music.163.com",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "content-type": "application/x-www-form-urlencoded",
    accept: "*/*",
    origin: "https://music.163.com",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    referer: "https://music.163.com/search/",
    "accept-language": "zh-CN,zh;q=0.9",
  };
  if (type === "music") {
    const res = (
      await (0, axios_1.default)({
        method: "post",
        url: `https://music.163.com/weapi/v1/artist/${artistItem.id}?csrf_token=`,
        headers,
        data: paeData,
      })
    ).data;
    return {
      isEnd: true,
      data: res.hotSongs.map(formatMusicItem),
    };
  } else if (type === "album") {
    const res = (
      await (0, axios_1.default)({
        method: "post",
        url: `https://music.163.com/weapi/artist/albums/${artistItem.id}?csrf_token=`,
        headers,
        data: paeData,
      })
    ).data;
    return {
      isEnd: true,
      data: res.hotAlbums.map(formatAlbumItem),
    };
  }
}
async function getTopListDetail(topListItem) {
  const musicList = await getSheetMusicById(topListItem.id);
  return Object.assign(Object.assign({}, topListItem), { musicList });
}
async function getLyric(musicItem) {
  const headers = {
    Referer: "https://y.music.163.com/",
    Origin: "https://y.music.163.com/",
    authority: "music.163.com",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const data = { id: musicItem.id, lv: -1, tv: -1, rv: -1, csrf_token: "" };
  const pae = getParamsAndEnc(JSON.stringify(data));
  const paeData = qs.stringify(pae);
  const result = (
    await (0, axios_1.default)({
      method: "post",
      url: `https://interface.music.163.com/weapi/song/lyric?csrf_token=`,
      headers,
      data: paeData,
    })
  ).data;
  return {
    rawLrc: result.lrc?.lyric,
    translation: result.tlyric?.lyric,
    romanization: result.romalrc?.lyric,
  };
}
async function getMusicInfo(musicBase) {
  const headers = {
    Referer: "https://y.music.163.com/",
    Origin: "https://y.music.163.com/",
    authority: "music.163.com",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const songId = musicBase.id || musicBase.songid;
  if (!songId) {
    console.error('[网易云] getMusicInfo: 缺少有效的歌曲ID');
    return null;
  }

  try {
    const data = { id: songId, ids: `[${songId}]` };
    const result = (
      await axios_1.get("http://music.163.com/api/song/detail", {
        headers,
        params: data,
      })
    ).data;

    if (!result.songs || result.songs.length === 0) {
      console.error('[网易云] getMusicInfo: 未找到歌曲信息');
      return null;
    }

    const song = result.songs[0];
    const album = song.album || song.al;
    const artists = song.artists || song.ar || [];

    // 获取音质信息
    let qualities = {};
    try {
      qualities = await getMusicQualityInfo(songId);
    } catch (e) {
      console.error('[网易云] 获取音质信息失败:', e.message);
    }

    return {
      id: song.id,
      title: song.name,
      artist: artists.map(a => a.name).join(', '),
      album: album ? album.name : undefined,
      albumId: album ? album.id : undefined,
      artwork: album ? album.picUrl : undefined,
      duration: song.duration ? Math.floor(song.duration / 1000) : undefined,
      qualities: Object.keys(qualities).length > 0 ? qualities : { '128k': {}, '320k': {} },
      platform: '网易云音乐',
    };
  } catch (error) {
    console.error('[网易云] getMusicInfo 错误:', error.message);
    return null;
  }
}
async function getAlbumInfo(albumItem) {
  const headers = {
    Referer: "https://y.music.163.com/",
    Origin: "https://y.music.163.com/",
    authority: "music.163.com",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const data = {
    resourceType: 3,
    resourceId: albumItem.id,
    limit: 15,
    csrf_token: "",
  };
  const pae = getParamsAndEnc(JSON.stringify(data));
  const paeData = qs.stringify(pae);
  const res = (
    await (0, axios_1.default)({
      method: "post",
      url: `https://interface.music.163.com/weapi/v1/album/${albumItem.id}?csrf_token=`,
      headers,
      data: paeData,
    })
  ).data;
  return {
    albumItem: { description: res.album.description },
    musicList: (res.songs || []).map(formatMusicItem),
  };
}
async function getValidMusicItems(trackIds) {
  const headers = {
    Referer: "https://y.music.163.com/",
    Origin: "https://y.music.163.com/",
    authority: "music.163.com",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  try {
    // 使用 weapi 接口获取带有 privilege 信息的歌曲详情
    const data = {
      c: JSON.stringify(
        trackIds.map((id) => ({
          id: id,
          v: 0,
        }))
      ),
      ids: JSON.stringify(trackIds),
    };
    const pae = getParamsAndEnc(JSON.stringify(data));
    const paeData = qs.stringify(pae);
    
    const res = (
      await axios_1.default({
        method: "post",
        url: "https://music.163.com/weapi/v3/song/detail",
        headers,
        data: paeData,
      })
    ).data;
    
    // 检查返回数据的有效性
    if (res.code !== 200 || !res.songs || !res.privileges) {
      console.error("[网易云] 获取歌曲详情失败:", res.code, res.msg);
      return [];
    }
    
    // 将 privilege 信息合并到歌曲对象中
    const songsWithPrivilege = res.songs.map((song, index) => {
      const privilege = res.privileges.find(p => p.id === song.id) || res.privileges[index];
      return {
        ...song,
        privilege: privilege
      };
    });
    
    // 格式化歌曲项
    const validMusicItems = songsWithPrivilege.map(formatMusicItem);
    
    // 批量获取音质信息
    const idList = validMusicItems.map(item => item.id);
    const qualityInfoMap = await getBatchMusicQualityInfo(idList);
    
    // 将音质信息合并到歌曲项中
    validMusicItems.forEach(item => {
      const qualityInfo = qualityInfoMap[item.id];
      if (qualityInfo) {
        item.qualities = qualityInfo;
      }
    });
    
    return validMusicItems;
  } catch (e) {
    console.error("[网易云] 获取歌单歌曲失败:", e);
    return [];
  }
}

async function getSheetMusicById(id) {
  const headers = {
    Referer: "https://y.music.163.com/",
    Origin: "https://y.music.163.com/",
    authority: "music.163.com",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
  };
  const sheetDetail = (
    await axios_1.default.get(
      `https://music.163.com/api/v3/playlist/detail?id=${id}&n=5000`,
      {
        headers,
      }
    )
  ).data;
  const trackIds = sheetDetail.playlist.trackIds.map((_) => _.id);
  let result = [];
  let idx = 0;
  while (idx * 200 < trackIds.length) {
    const res = await getValidMusicItems(
      trackIds.slice(idx * 200, (idx + 1) * 200)
    );
    result = result.concat(res);
    ++idx;
  }
  return result;
}
async function importMusicSheet(urlLike) {
  const matchResult = urlLike.match(
    /(?:https:\/\/y\.music\.163.com\/m\/playlist\?id=([0-9]+))|(?:https?:\/\/music\.163\.com\/playlist\/([0-9]+)\/.*)|(?:https?:\/\/music.163.com(?:\/#)?\/playlist\?id=(\d+))|(?:^\s*(\d+)\s*$)/
  );
  const id =
    matchResult[1] || matchResult[2] || matchResult[3] || matchResult[4];
  return getSheetMusicById(id);
}
async function getTopLists() {
  const res = await axios_1.default.get(
    "https://music.163.com/discover/toplist",
    {
      headers: {
        referer: "https://music.163.com/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54",
      },
    }
  );
  const $ = cheerio.load(res.data);
  const children = $(".n-minelst").children();
  const groups = [];
  let currentGroup = {};
  for (let c of children) {
    if (c.tagName == "h2") {
      if (currentGroup.title) {
        groups.push(currentGroup);
      }
      currentGroup = {};
      currentGroup.title = $(c).text();
      currentGroup.data = [];
    } else if (c.tagName === "ul") {
      let sections = $(c).children();
      currentGroup.data = sections
        .map((index, element) => {
          const ele = $(element);
          const id = ele.attr("data-res-id");
          const coverImg = ele
            .find("img")
            .attr("src")
            .replace(/(\.jpg\?).*/, ".jpg?param=800y800");
          const title = ele.find("p.name").text();
          const description = ele.find("p.s-fc4").text();
          return {
            id,
            coverImg,
            title,
            description,
          };
        })
        .toArray();
    }
  }
  if (currentGroup.title) {
    groups.push(currentGroup);
  }
  return groups;
}
const qualityLevels = {
  "128k": "128k",
  "320k": "320k", 
  "flac": "flac",
  "flac24bit": "flac24bit",
  "hires": "hires",
  "atmos": "atmos",
  "master": "master",
};

async function getMediaSource(musicItem, quality) {
  try {
    // 检查音质信息
    if (musicItem.qualities && Object.keys(musicItem.qualities).length > 0) {
      // 如果歌曲不支持请求的音质，返回错误
      if (!musicItem.qualities[quality]) {
        console.error(`[网易云] 歌曲不支持音质 ${quality}`);
        throw new Error(`该歌曲不支持 ${quality} 音质`);
      }
    }
    
    // 直接使用质量键，因为现在quality参数就是标准的音质键(如"128k", "320k"等)
    const qualityParam = qualityLevels[quality] || quality;
    
    const res = (
      await axios_1.default.get(
        `${API_URL}/url?source=wy&songId=${musicItem.id}&quality=${qualityParam}`,
        {
          "headers": {
            "X-Request-Key": API_KEY,
            "X-API-Key": API_KEY,
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
      console.error(`[网易云] 获取播放链接失败: ${res.msg || '未知错误'}`);
      return null;
    }
  } catch (error) {
    console.error(`[网易云] 获取播放源错误: ${error.message}`);
    throw error;
  }
}
const headers = {
  authority: "music.163.com",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
  "content-type": "application/x-www-form-urlencoded",
  accept: "*/*",
  origin: "https://music.163.com",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  referer: "https://music.163.com/",
  "accept-language": "zh-CN,zh;q=0.9",
};
async function getRecommendSheetTags() {
  const data = {
    csrf_token: "",
  };
  const pae = getParamsAndEnc(JSON.stringify(data));
  const paeData = qs.stringify(pae);
  const res = (
    await (0, axios_1.default)({
      method: "post",
      url: "https://music.163.com/weapi/playlist/catalogue",
      headers,
      data: paeData,
    })
  ).data;
  const cats = res.categories;
  const map = {};
  const catData = Object.entries(cats).map((_) => {
    const tagData = {
      title: _[1],
      data: [],
    };
    map[_[0]] = tagData;
    return tagData;
  });
  const pinned = [];
  res.sub.forEach((tag) => {
    const _tag = {
      id: tag.name,
      title: tag.name,
    };
    if (tag.hot) {
      pinned.push(_tag);
    }
    map[tag.category].data.push(_tag);
  });
  return {
    pinned,
    data: catData,
  };
}
async function getRecommendSheetsByTag(tag, page) {
  const pageSize = 20;
  const data = {
    cat: tag.id || "全部",
    order: "hot",
    limit: pageSize,
    offset: (page - 1) * pageSize,
    total: true,
    csrf_token: "",
  };
  const pae = getParamsAndEnc(JSON.stringify(data));
  const paeData = qs.stringify(pae);
  const res = (
    await (0, axios_1.default)({
      method: "post",
      url: "https://music.163.com/weapi/playlist/list",
      headers,
      data: paeData,
    })
  ).data;
  const playLists = res.playlists.map((_) => ({
    id: _.id,
    artist: _.creator.nickname,
    title: _.name,
    artwork: _.coverImgUrl,
    playCount: _.playCount,
    createUserId: _.userId,
    createTime: _.createTime,
    description: _.description,
  }));
  return {
    isEnd: !(res.more === true),
    data: playLists,
  };
}
async function getMusicSheetInfo(sheet, page) {
  let trackIds = sheet._trackIds;
  if (!trackIds) {
    const id = sheet.id;
    const headers = {
      Referer: "https://y.music.163.com/",
      Origin: "https://y.music.163.com/",
      authority: "music.163.com",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
    };
    const sheetDetail = (
      await axios_1.default.get(
        `https://music.163.com/api/v3/playlist/detail?id=${id}&n=5000`,
        {
          headers,
        }
      )
    ).data;
    trackIds = sheetDetail.playlist.trackIds.map((_) => _.id);
  }
  const pageSize = 40;
  const currentPageIds = trackIds.slice((page - 1) * pageSize, page * pageSize);
  const res = await getValidMusicItems(currentPageIds);
  let extra = {};
  if (page <= 1) {
    extra = {
      _trackIds: trackIds,
    };
  }
  return Object.assign(
    { isEnd: trackIds.length <= page * pageSize, musicList: res },
    extra
  );
}
async function getMusicComments(musicItem, page = 1) {
  const pageSize = 20;
  const id = 'R_SO_4_' + musicItem.id;

  try {
    const pae = getParamsAndEnc(
      JSON.stringify({
        rid: id,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        csrf_token: '',
      })
    );

    const res = await axios_1.default.post(
      `https://music.163.com/weapi/v1/resource/hotcomments/${id}`,
      qs.stringify(pae),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
          'accept': '*/*',
          'origin': 'https://music.163.com',
          'referer': 'http://music.163.com/',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (res.status !== 200) {
      return { isEnd: true, data: [] };
    }

    const hotComments = (res.data.hotComments || []).map((item) => ({
      id: item.commentId?.toString(),
      nickName: item.user?.nickname || '',
      avatar: item.user?.avatarUrl,
      comment: item.content || '',
      like: item.likedCount,
      createAt: item.time,
      location: item.ipLocation?.location,
      replies: (item.beReplied || []).map((reply) => ({
        id: reply.beRepliedCommentId?.toString(),
        nickName: reply.user?.nickname || '',
        avatar: reply.user?.avatarUrl,
        comment: reply.content || '',
        like: null,
        createAt: null,
        location: reply.ipLocation?.location,
      })),
    }));

    const hasMore = res.data.hasMore || false;

    return {
      isEnd: !hasMore,
      data: hotComments,
    };
  } catch (error) {
    console.error('[网易云] 获取热评失败:', error);
    return { isEnd: true, data: [] };
  }
}
module.exports = {
  platform: "网易云音乐",
  author: "Toskysun", 
  version: "0.2.3",
  appVersion: ">0.1.0-alpha.0",
  srcUrl: UPDATE_URL,
  cacheControl: "no-store",
  // 声明插件支持的音质列表（基于网易云音乐实际提供的音质）
  supportedQualities: ["128k", "320k", "flac", "hires", "atmos", "master"],
  primaryKey: ["id"],
  hints: {
    importMusicSheet: [
      "网易云：APP点击分享，然后复制链接", 
      "默认歌单无法导入，先新建一个空白歌单复制过去再导入新歌单即可",
    ],
  },
  supportedSearchType: ["music", "album", "sheet", "artist", "lyric"],
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
  getMediaSource,
  getMusicInfo,
  getAlbumInfo,
  getLyric,
  getArtistWorks,
  importMusicSheet,
  getTopLists,
  getTopListDetail,
  getRecommendSheetTags,
  getMusicSheetInfo,
  getRecommendSheetsByTag,
  getMusicComments,
};
