const API_URL = "{{API_URL}}";
const API_KEY = "{{API_KEY}}";
const UPDATE_URL = "{{UPDATE_URL}}";

("use strict");
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const CryptoJs = require("crypto-js");
const he = require("he");
const pageSize = 20;
// 批量获取QQ音乐的音质信息
async function getBatchMusicQualityInfo(songList) {
  if (!songList || songList.length === 0) return {};
  
  try {
    const res = await axios_1.default({
      url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
      method: "POST",
      data: {
        comm: {
          ct: '19',
          cv: '1859',
          uin: '0',
        },
        req: {
          module: 'music.trackInfo.UniformRuleCtrl',
          method: 'CgiGetTrackInfo',
          param: {
            types: songList.map(() => 1),
            ids: songList.map(item => item.id || item.songid),
            ctx: 0,
          },
        },
      },
      headers: {
        referer: "https://y.qq.com",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
        Cookie: "uin=",
      },
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    });
    
    const qualityInfoMap = {};
    
    if (res.data && res.data.req && res.data.req.data && res.data.req.data.tracks) {
      res.data.req.data.tracks.forEach((track) => {
        const file = track.file;
        const songId = track.id;
        const qualities = {};
        
        // 128k
        if (file.size_128mp3 && file.size_128mp3 !== 0) {
          qualities['128k'] = {
            size: file.size_128mp3,
            bitrate: 128000,
          };
        }
        
        // 320k
        if (file.size_320mp3 && file.size_320mp3 !== 0) {
          qualities['320k'] = {
            size: file.size_320mp3,
            bitrate: 320000,
          };
        }
        
        // FLAC
        if (file.size_flac && file.size_flac !== 0) {
          qualities['flac'] = {
            size: file.size_flac,
            bitrate: 1411000,
          };
        }
        
        // Hi-Res
        if (file.size_hires && file.size_hires !== 0) {
          qualities['hires'] = {
            size: file.size_hires,
            bitrate: file.size_hires > 50000000 ? 2304000 : 1536000, // 估算码率
          };
        }
        
        // Dolby Atmos 全景声
        if (file.size_new && file.size_new[1] !== 0) {
          qualities['atmos'] = {
            size: file.size_new[1],
            bitrate: 1411000, // Atmos通常基于无损
          };
        }
        
        // Dolby Atmos Plus
        if (file.size_new && file.size_new[2] !== 0) {
          qualities['atmos_plus'] = {
            size: file.size_new[2],
            bitrate: 1411000,
          };
        }
        
        // Master 母带音质
        if (file.size_new && file.size_new[0] !== 0) {
          qualities['master'] = {
            size: file.size_new[0],
            bitrate: 2304000, // Master通常是Hi-Res级别
          };
        }
        
        qualityInfoMap[songId] = qualities;
      });
    }
    
    return qualityInfoMap;
  } catch (error) {
    console.error('Failed to fetch QQ Music quality info:', error);
    return {};
  }
}

function formatMusicItem(_, qualityInfo = {}) {
  var _a, _b, _c;
  const albumid =
    _.albumid || ((_a = _.album) === null || _a === void 0 ? void 0 : _a.id);
  const albummid =
    _.albummid || ((_b = _.album) === null || _b === void 0 ? void 0 : _b.mid);
  const albumname =
    _.albumname ||
    ((_c = _.album) === null || _c === void 0 ? void 0 : _c.title);
  
  // 使用从API获取的真实音质信息，如果没有则提供基础支持
  const songId = _.id || _.songid;
  let qualities = qualityInfo[songId] || {};
  
  // 如果没有获取到音质信息，提供基础音质作为降级方案
  if (Object.keys(qualities).length === 0) {
    const basicQualities = ['128k', '320k', 'flac'];
    basicQualities.forEach(quality => {
      qualities[quality] = {};
    });
  }
  
  return {
    id: _.id || _.songid,
    songmid: _.mid || _.songmid,
    title: _.title || _.songname,
    artist: _.singer.map((s) => s.name).join(", "),
    artwork: albummid
      ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${albummid}.jpg`
      : undefined,
    album: albumname,
    lrc: _.lyric || undefined,
    albumid: albumid,
    albummid: albummid,
    qualities: qualities,
  };
}
function formatAlbumItem(_) {
  return {
    id: _.albumID || _.albumid,
    albumMID: _.albumMID || _.album_mid,
    title: _.albumName || _.album_name,
    artwork:
      _.albumPic ||
      `https://y.gtimg.cn/music/photo_new/T002R800x800M000${
        _.albumMID || _.album_mid
      }.jpg`,
    date: _.publicTime || _.pub_time,
    singerID: _.singerID || _.singer_id,
    artist: _.singerName || _.singer_name,
    singerMID: _.singerMID || _.singer_mid,
    description: _.desc,
  };
}
function formatArtistItem(_) {
  return {
    name: _.singerName,
    id: _.singerID,
    singerMID: _.singerMID,
    avatar: _.singerPic,
    worksNum: _.songNum,
  };
}
const searchTypeMap = {
  0: "song",
  2: "album",
  1: "singer",
  3: "songlist",
  7: "song",
  12: "mv",
};
const headers = {
  referer: "https://y.qq.com",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
  Cookie: "uin=",
};
async function searchBase(query, page, type) {
  const res = (
    await (0, axios_1.default)({
      url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
      method: "POST",
      data: {
        req_1: {
          method: "DoSearchForQQMusicDesktop",
          module: "music.search.SearchCgiService",
          param: {
            num_per_page: pageSize,
            page_num: page,
            query: query,
            search_type: type,
          },
        },
      },
      headers: headers,
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  return {
    isEnd: res.req_1.data.meta.sum <= page * pageSize,
    data: res.req_1.data.body[searchTypeMap[type]].list,
  };
}
async function searchMusic(query, page) {
  const songs = await searchBase(query, page, 0);
  
  // 批量获取音质信息
  let qualityInfoMap = {};
  try {
    qualityInfoMap = await getBatchMusicQualityInfo(songs.data);
  } catch (error) {
    console.error('Failed to get quality info for QQ Music search:', error);
  }
  
  return {
    isEnd: songs.isEnd,
    data: songs.data.map(song => formatMusicItem(song, qualityInfoMap)),
  };
}
async function searchAlbum(query, page) {
  const albums = await searchBase(query, page, 2);
  return {
    isEnd: albums.isEnd,
    data: albums.data.map(formatAlbumItem),
  };
}
async function searchArtist(query, page) {
  const artists = await searchBase(query, page, 1);
  return {
    isEnd: artists.isEnd,
    data: artists.data.map(formatArtistItem),
  };
}
async function searchMusicSheet(query, page) {
  const musicSheet = await searchBase(query, page, 3);
  return {
    isEnd: musicSheet.isEnd,
    data: musicSheet.data.map((item) => ({
      title: item.dissname,
      createAt: item.createtime,
      description: item.introduction,
      playCount: item.listennum,
      worksNums: item.song_count,
      artwork: item.imgurl,
      id: item.dissid,
      artist: item.creator.name,
    })),
  };
}
async function searchLyric(query, page) {
  const songs = await searchBase(query, page, 7);
  return {
    isEnd: songs.isEnd,
    data: songs.data.map((it) =>
      Object.assign(Object.assign({}, formatMusicItem(it)), {
        rawLrcTxt: it.content,
      })
    ),
  };
}
function getQueryFromUrl(key, search) {
  try {
    const sArr = search.split("?");
    let s = "";
    if (sArr.length > 1) {
      s = sArr[1];
    } else {
      return key ? undefined : {};
    }
    const querys = s.split("&");
    const result = {};
    querys.forEach((item) => {
      const temp = item.split("=");
      result[temp[0]] = decodeURIComponent(temp[1]);
    });
    return key ? result[key] : result;
  } catch (err) {
    return key ? "" : {};
  }
}
function changeUrlQuery(obj, baseUrl) {
  const query = getQueryFromUrl(null, baseUrl);
  let url = baseUrl.split("?")[0];
  const newQuery = Object.assign(Object.assign({}, query), obj);
  let queryArr = [];
  Object.keys(newQuery).forEach((key) => {
    if (newQuery[key] !== undefined && newQuery[key] !== "") {
      queryArr.push(`${key}=${encodeURIComponent(newQuery[key])}`);
    }
  });
  return `${url}?${queryArr.join("&")}`.replace(/\?$/, "");
}
const typeMap = {
  m4a: {
    s: "C400",
    e: ".m4a",
  },
  128: {
    s: "M500",
    e: ".mp3",
  },
  320: {
    s: "M800",
    e: ".mp3",
  },
  ape: {
    s: "A000",
    e: ".ape",
  },
  flac: {
    s: "F000",
    e: ".flac",
  },
};
async function getAlbumInfo(albumItem) {
  const url = changeUrlQuery(
    {
      data: JSON.stringify({
        comm: {
          ct: 24,
          cv: 10000,
        },
        albumSonglist: {
          method: "GetAlbumSongList",
          param: {
            albumMid: albumItem.albumMID,
            albumID: 0,
            begin: 0,
            num: 999,
            order: 2,
          },
          module: "music.musichallAlbum.AlbumSongList",
        },
      }),
    },
    "https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8"
  );
  const res = (
    await (0, axios_1.default)({
      url: url,
      headers: headers,
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  
  const songList = res.albumSonglist.data.songList.map(item => item.songInfo);
  
  // 批量获取音质信息
  let qualityInfoMap = {};
  try {
    qualityInfoMap = await getBatchMusicQualityInfo(songList);
  } catch (error) {
    console.error('Failed to get quality info for album:', error);
  }
  
  return {
    musicList: songList.map((songInfo) => formatMusicItem(songInfo, qualityInfoMap)),
  };
}
async function getArtistSongs(artistItem, page) {
  const url = changeUrlQuery(
    {
      data: JSON.stringify({
        comm: {
          ct: 24,
          cv: 0,
        },
        singer: {
          method: "get_singer_detail_info",
          param: {
            sort: 5,
            singermid: artistItem.singerMID,
            sin: (page - 1) * pageSize,
            num: pageSize,
          },
          module: "music.web_singer_info_svr",
        },
      }),
    },
    "http://u.y.qq.com/cgi-bin/musicu.fcg"
  );
  const res = (
    await (0, axios_1.default)({
      url: url,
      method: "get",
      headers: headers,
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  
  const songList = res.singer.data.songlist;
  
  // 批量获取音质信息
  let qualityInfoMap = {};
  try {
    qualityInfoMap = await getBatchMusicQualityInfo(songList);
  } catch (error) {
    console.error('Failed to get quality info for artist songs:', error);
  }
  
  return {
    isEnd: res.singer.data.total_song <= page * pageSize,
    data: songList.map(song => formatMusicItem(song, qualityInfoMap)),
  };
}
async function getArtistAlbums(artistItem, page) {
  const url = changeUrlQuery(
    {
      data: JSON.stringify({
        comm: {
          ct: 24,
          cv: 0,
        },
        singerAlbum: {
          method: "get_singer_album",
          param: {
            singermid: artistItem.singerMID,
            order: "time",
            begin: (page - 1) * pageSize,
            num: pageSize / 1,
            exstatus: 1,
          },
          module: "music.web_singer_info_svr",
        },
      }),
    },
    "http://u.y.qq.com/cgi-bin/musicu.fcg"
  );
  const res = (
    await (0, axios_1.default)({
      url,
      method: "get",
      headers: headers,
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  return {
    isEnd: res.singerAlbum.data.total <= page * pageSize,
    data: res.singerAlbum.data.list.map(formatAlbumItem),
  };
}
async function getArtistWorks(artistItem, page, type) {
  if (type === "music") {
    return getArtistSongs(artistItem, page);
  }
  if (type === "album") {
    return getArtistAlbums(artistItem, page);
  }
}
async function getLyric(musicItem) {
  try {
    // 使用正确的 API（支持罗马音）
    const res = await (0, axios_1.default)({
      url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
      method: "POST",
      data: {
        comm: {
          ct: "19",
          cv: "1859",
          uin: "0",
        },
        req: {
          method: "GetPlayLyricInfo",
          module: "music.musichallSong.PlayLyricInfo",
          param: {
            format: "json",
            crypt: 1,           // 启用加密
            qrc: 1,             // qrc格式
            qrc_t: 0,
            roma: 1,            // ⭐ 请求罗马音
            roma_t: 0,
            trans: 1,           // 请求翻译
            trans_t: 0,
            songID: musicItem.id || musicItem.songid,
            type: -1,
          },
        },
      },
      headers: {
        referer: "https://y.qq.com",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
      },
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    });

    if (res.data?.code === 0 && res.data?.req?.code === 0) {
      const data = res.data.req.data;

      // 返回加密的 hex 字符串，应用层会自动解密
      return {
        rawLrc: data.lyric || undefined,        // 原文（加密）
        translation: data.trans || undefined,    // 译文（加密）
        romanization: data.roma || undefined,    // 罗马音（加密）✨
      };
    }

    // API 失败，降级到旧 API
    throw new Error("新 API 返回错误");
  } catch (error) {
    console.warn("[QQ音乐] 新 API 失败，降级到旧 API:", error.message);
    return getLyricLegacy(musicItem);
  }
}

// 旧 API（降级方案）
async function getLyricLegacy(musicItem) {
  const result = (
    await (0, axios_1.default)({
      url: `http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${
        musicItem.songmid
      }&pcachetime=${new Date().getTime()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
      headers: { Referer: "https://y.qq.com", Cookie: "uin=" },
      method: "get",
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  const res = JSON.parse(
    result.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, "")
  );
  let translation;
  if (res.trans) {
    translation = he.decode(
      CryptoJs.enc.Base64.parse(res.trans).toString(CryptoJs.enc.Utf8)
    );
  }
  return {
    rawLrc: he.decode(
      CryptoJs.enc.Base64.parse(res.lyric).toString(CryptoJs.enc.Utf8)
    ),
    translation,
  };
}
async function importMusicSheet(urlLike) {
  let id;
  if (!id) {
    id = (urlLike.match(
      /https?:\/\/i\.y\.qq\.com\/n2\/m\/share\/details\/taoge\.html\?.*id=([0-9]+)/
    ) || [])[1];
  }
  if (!id) {
    id = (urlLike.match(/https?:\/\/y\.qq\.com\/n\/ryqq\/playlist\/([0-9]+)/) ||
      [])[1];
  }
  if (!id) {
    id = (urlLike.match(/^(\d+)$/) || [])[1];
  }
  if (!id) {
    return;
  }
  const result = (
    await (0, axios_1.default)({
      url: `http://i.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&utf8=1&disstid=${id}&loginUin=0`,
      headers: { Referer: "https://y.qq.com/n/yqq/playlist", Cookie: "uin=" },
      method: "get",
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  const res = JSON.parse(
    result.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, "")
  );
  
  // 获取歌单歌曲列表
  const songList = res.cdlist[0].songlist;
  
  // 批量获取音质信息
  let qualityInfoMap = {};
  try {
    qualityInfoMap = await getBatchMusicQualityInfo(songList);
  } catch (error) {
    console.error('[QQ音乐] 获取歌单音质信息失败:', error);
  }
  
  // 格式化歌曲列表并附加音质信息
  return songList.map(song => formatMusicItem(song, qualityInfoMap));
}
async function getTopLists() {
  const list = await (0, axios_1.default)({
    url: "https://u.y.qq.com/cgi-bin/musicu.fcg?_=1577086820633&data=%7B%22comm%22%3A%7B%22g_tk%22%3A5381%2C%22uin%22%3A123456%2C%22format%22%3A%22json%22%2C%22inCharset%22%3A%22utf-8%22%2C%22outCharset%22%3A%22utf-8%22%2C%22notice%22%3A0%2C%22platform%22%3A%22h5%22%2C%22needNewCode%22%3A1%2C%22ct%22%3A23%2C%22cv%22%3A0%7D%2C%22topList%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetAll%22%2C%22param%22%3A%7B%7D%7D%7D",
    method: "get",
    headers: {
      Cookie: "uin=",
    },
    xsrfCookieName: "XSRF-TOKEN",
    withCredentials: true,
  });
  return list.data.topList.data.group.map((e) => ({
    title: e.groupName,
    data: e.toplist.map((_) => ({
      id: _.topId,
      description: _.intro,
      title: _.title,
      period: _.period,
      coverImg: _.headPicUrl || _.frontPicUrl,
    })),
  }));
}
async function getTopListDetail(topListItem) {
  var _a;
  const res = await (0, axios_1.default)({
    url: `https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=5381&data=%7B%22detail%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetDetail%22%2C%22param%22%3A%7B%22topId%22%3A${
      topListItem.id
    }%2C%22offset%22%3A0%2C%22num%22%3A100%2C%22period%22%3A%22${
      (_a = topListItem.period) !== null && _a !== void 0 ? _a : ""
    }%22%7D%7D%2C%22comm%22%3A%7B%22ct%22%3A24%2C%22cv%22%3A0%7D%7D`,
    method: "get",
    headers: {
      Cookie: "uin=",
    },
    xsrfCookieName: "XSRF-TOKEN",
    withCredentials: true,
  });
  
  const songList = res.data.detail.data.songInfoList;
  
  // 批量获取音质信息
  let qualityInfoMap = {};
  try {
    qualityInfoMap = await getBatchMusicQualityInfo(songList);
  } catch (error) {
    console.error('Failed to get quality info for top list:', error);
  }
  
  return Object.assign(Object.assign({}, topListItem), {
    musicList: songList.map(song => formatMusicItem(song, qualityInfoMap)),
  });
}
async function getRecommendSheetTags() {
  const res = (
    await axios_1.default.get(
      "https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg?format=json&inCharset=utf8&outCharset=utf-8",
      {
        headers: {
          referer: "https://y.qq.com/",
        },
      }
    )
  ).data.data.categories;
  const data = res.slice(1).map((_) => ({
    title: _.categoryGroupName,
    data: _.items.map((tag) => ({
      id: tag.categoryId,
      title: tag.categoryName,
    })),
  }));
  const pinned = [];
  for (let d of data) {
    if (d.data.length) {
      pinned.push(d.data[0]);
    }
  }
  return {
    pinned,
    data,
  };
}
async function getRecommendSheetsByTag(tag, page) {
  const pageSize = 20;
  const rawRes = (
    await axios_1.default.get(
      "https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg",
      {
        headers: {
          referer: "https://y.qq.com/",
        },
        params: {
          inCharset: "utf8",
          outCharset: "utf-8",
          sortId: 5,
          categoryId:
            (tag === null || tag === void 0 ? void 0 : tag.id) || "10000000",
          sin: pageSize * (page - 1),
          ein: page * pageSize - 1,
        },
      }
    )
  ).data;
  const res = JSON.parse(
    rawRes.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, "")
  ).data;
  const isEnd = res.sum <= page * pageSize;
  const data = res.list.map((item) => {
    var _a, _b;
    return {
      id: item.dissid,
      createTime: item.createTime,
      title: item.dissname,
      artwork: item.imgurl,
      description: item.introduction,
      playCount: item.listennum,
      artist:
        (_b =
          (_a = item.creator) === null || _a === void 0 ? void 0 : _a.name) !==
          null && _b !== void 0
          ? _b
          : "",
    };
  });
  return {
    isEnd,
    data,
  };
}
async function getMusicSheetInfo(sheet, page) {
  const data = await importMusicSheet(sheet.id);
  return {
    isEnd: true,
    musicList: data,
  };
}
// MusicFree标准音质键映射 
const qualityLevels = {
  "128k": "128k",
  "320k": "320k",
  "flac": "flac", 
  "flac24bit": "flac24bit",
  "hires": "hires",
  "atmos": "atmos",
  "atmos_plus": "atmos_plus",
  "master": "master",
};

async function getMediaSource(musicItem, quality) {
  try {
    // 检查音质信息
    if (musicItem.qualities && Object.keys(musicItem.qualities).length > 0) {
      // 如果歌曲不支持请求的音质，返回错误
      if (!musicItem.qualities[quality]) {
        console.error(`[QQ音乐] 歌曲不支持音质 ${quality}`);
        throw new Error(`该歌曲不支持 ${quality} 音质`);
      }
    }
    
    // 直接使用质量键，因为现在quality参数就是标准的音质键
    const qualityParam = qualityLevels[quality] || quality;
    
    const res = (
      await axios_1.default.get(
        `${API_URL}/url?source=tx&songId=${musicItem.songmid}&quality=${qualityParam}`,
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
      console.error(`[QQ音乐] 获取播放链接失败: ${res.msg || '未知错误'}`);
      return null;
    }
  } catch (error) {
    console.error(`[QQ音乐] 获取播放源错误: ${error.message}`);
    throw error;
  }
}
// 获取歌曲详细信息（用于评论功能）
async function getMusicInfoForComment(musicItem) {
  try {
    // 如果已经有 id，直接返回
    if (musicItem.id && typeof musicItem.id === 'number') {
      return musicItem.id;
    }

    // 使用 songmid 获取详细信息
    const res = await axios_1.default.post(
      'https://u.y.qq.com/cgi-bin/musicu.fcg',
      {
        comm: {
          ct: '19',
          cv: '1859',
          uin: '0',
        },
        req: {
          module: 'music.trackInfo.UniformRuleCtrl',
          method: 'CgiGetTrackInfo',
          param: {
            types: [1],
            ids: [musicItem.id || 0],
            mids: [musicItem.songmid],
            ctx: 0,
          },
        },
      },
      {
        headers: {
          referer: 'https://y.qq.com',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
          Cookie: 'uin=',
        },
      }
    );

    if (res.data && res.data.req && res.data.req.data && res.data.req.data.tracks && res.data.req.data.tracks[0]) {
      return res.data.req.data.tracks[0].id;
    }

    return typeof musicItem.id === 'number' ? musicItem.id : null;
  } catch (error) {
    console.error('[QQ音乐] 获取歌曲信息失败:', error);
    return typeof musicItem.id === 'number' ? musicItem.id : null;
  }
}

// 获取热评论
async function getMusicComments(musicItem, page = 1) {
  const pageSize = 20;

  try {
    // 获取真实的 songId
    const songId = await getMusicInfoForComment(musicItem);

    // 验证 songId 有效性
    if (!songId || typeof songId !== 'number') {
      console.error('[QQ音乐] 无效的歌曲ID:', songId);
      return { isEnd: true, data: [] };
    }

    const res = await axios_1.default.post(
      'https://u.y.qq.com/cgi-bin/musicu.fcg',
      {
        comm: {
          cv: 4747474,
          ct: 24,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          platform: 'yqq.json',
          needNewCode: 1,
          uin: 0
        },
        req: {
          module: 'music.globalComment.CommentRead',
          method: 'GetHotCommentList',
          param: {
            BizType: 1,
            BizId: String(songId),
            LastCommentSeqNo: '',
            PageSize: pageSize,
            PageNum: page - 1,
            HotType: 1,
            WithAirborne: 0,
            PicEnable: 1
          }
        }
      },
      {
        headers: {
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
          referer: 'https://y.qq.com/',
          origin: 'https://y.qq.com',
          'content-type': 'application/json; charset=utf-8'
        }
      }
    );

    if (res.data.code !== 0 || !res.data.req || res.data.req.code !== 0) {
      console.error('[QQ音乐] 获取热评论失败:', res.data);
      return { isEnd: true, data: [] };
    }

    const commentList = res.data.req.data?.CommentList?.Comments || [];
    const comments = commentList.map((item) => {
      const comment = {
        id: item.CmId,
        nickName: item.Nick || '',
        avatar: item.Avatar,
        comment: item.Content || '',
        like: item.PraiseNum || 0,
        createAt: item.PubTime ? parseInt(item.PubTime + '000') : null,
        replies: []
      };

      // 处理子评论
      if (item.SubComments && Array.isArray(item.SubComments)) {
        comment.replies = item.SubComments.map((c) => ({
          id: c.CmId,
          nickName: c.Nick || '',
          avatar: c.Avatar || '',
          comment: c.Content || '',
          like: c.PraiseNum || 0,
          createAt: c.PubTime ? parseInt(c.PubTime + '000') : null,
        }));
      }

      return comment;
    });

    // 热评论通常数量有限，判断是否结束
    return {
      isEnd: commentList.length < pageSize,
      data: comments,
    };
  } catch (error) {
    console.error('[QQ音乐] 获取热评论失败:', error);
    return { isEnd: true, data: [] };
  }
}
module.exports = {
  platform: "QQ音乐",
  author: "Toskysun",
  version: "0.2.2",
  srcUrl: UPDATE_URL,
  cacheControl: "no-cache",
  // 声明插件支持的音质列表
  supportedQualities: ["128k", "320k", "flac", "flac24bit", "hires", "atmos", "atmos_plus", "master"],
  hints: {
    importMusicSheet: [
      "QQ音乐APP：自建歌单-分享-分享到微信好友/QQ好友；然后点开并复制链接，直接粘贴即可",
      "H5：复制URL并粘贴，或者直接输入纯数字歌单ID即可",
      "导入时间和歌单大小有关，请耐心等待",
    ],
  },
  primaryKey: ["id", "songmid"],
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
  getLyric,
  getAlbumInfo,
  getArtistWorks,
  importMusicSheet,
  getTopLists,
  getTopListDetail,
  getRecommendSheetTags,
  getRecommendSheetsByTag,
  getMusicSheetInfo,
  getMusicComments,
};
