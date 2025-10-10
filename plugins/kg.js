const API_URL = "http://103.217.184.26:9000";
const API_KEY = "YOUR_KEY";
const UPDATE_URL = "https://musicfree-plugins.netlify.app/plugins/kg.js?key=YOUR_KEY";

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const cheerio_1 = require("cheerio");
const CryptoJs = require("crypto-js");
const he = require("he");
const pageSize = 20;

// 批量获取酷狗音乐的音质信息
async function getBatchMusicQualityInfo(hashList) {
  if (!hashList || hashList.length === 0) return {};
  
  const resources = hashList.map((hash) => ({
    id: 0,
    type: 'audio',
    hash,
  }));

  try {
    const res = await axios_1.default({
      url: `https://gateway.kugou.com/goodsmstore/v1/get_res_privilege?appid=1005&clientver=20049&clienttime=${Date.now()}&mid=NeZha`,
      method: 'post',
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      data: {
        behavior: 'play',
        clientver: '20049',
        resource: resources,
        area_code: '1',
        quality: '128',
        qualities: [
          '128',
          '320',
          'flac',
          'high',
          'dolby',
          'viper_atmos',
          'viper_tape',
          'viper_clear',
        ],
      },
    });

    const qualityInfoMap = {};

    if (res.data && res.data.error_code == 0 && res.data.data) {
      res.data.data.forEach((songData, index) => {
        const hash = hashList[index];
        const qualities = {};

        if (!songData || !songData.relate_goods) return;

        for (const quality_data of songData.relate_goods) {
          const size = quality_data.info.filesize;
          if (!size) continue;
          
          switch (quality_data.quality) {
            case '128':
              qualities['128k'] = {
                size: size,
                bitrate: 128000,
                hash: quality_data.hash
              };
              break;
            case '320':
              qualities['320k'] = {
                size: size,
                bitrate: 320000,
                hash: quality_data.hash
              };
              break;
            case 'flac':
              qualities['flac'] = {
                size: size,
                bitrate: 1411000,
                hash: quality_data.hash
              };
              break;
            case 'high':
              qualities['hires'] = {
                size: size,
                bitrate: 2304000,
                hash: quality_data.hash
              };
              break;
            case 'viper_clear':
              qualities['master'] = {
                size: size,
                bitrate: 2304000,
                hash: quality_data.hash
              };
              break;
            case 'viper_atmos':
              qualities['atmos'] = {
                size: size,
                bitrate: 1411000,
                hash: quality_data.hash
              };
              break;
          }
        }

        qualityInfoMap[hash] = qualities;
      });
    }

    return qualityInfoMap;
  } catch (error) {
    console.error('Failed to fetch KuGou quality info:', error);
    return {};
  }
}

function formatMusicItem(_, qualityInfo = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  
  // 使用从API获取的真实音质信息
  const fileHash = (_d = _.FileHash) !== null && _d !== void 0 ? _d : _.Grp[0].FileHash;
  let qualities = qualityInfo[fileHash] || {};
  
  // 如果没有获取到音质信息，提供基础音质作为降级方案
  if (Object.keys(qualities).length === 0) {
    const basicQualities = ['128k', '320k', 'flac'];
    basicQualities.forEach(quality => {
      qualities[quality] = {};
    });
  }
  
  return {
    id: fileHash,
    title: (_a = _.SongName) !== null && _a !== void 0 ? _a : _.OriSongName,
    artist:
      (_b = _.SingerName) !== null && _b !== void 0 ? _b : _.Singers[0].name,
    album:
      (_c = _.AlbumName) !== null && _c !== void 0 ? _c : _.Grp[0].AlbumName,
    album_id:
      (_e = _.AlbumID) !== null && _e !== void 0 ? _e : _.Grp[0].AlbumID,
    album_audio_id: 0,
    duration: _.Duration,
    artwork: ((_f = _.Image) !== null && _f !== void 0
      ? _f
      : _.Grp[0].Image
    ).replace("{size}", "1080"),
    "320hash": (_i = _.HQFileHash) !== null && _i !== void 0 ? _i : undefined,
    sqhash: (_g = _.SQFileHash) !== null && _g !== void 0 ? _g : undefined,
    ResFileHash:
      (_h = _.ResFileHash) !== null && _h !== void 0 ? _h : undefined,
    qualities: qualities,
  };
}
function formatMusicItem2(_) {
  var _a, _b, _c, _d, _e, _f, _g;
  
  // 构建符合MusicFree标准的音质对象
  const qualities = {};
  
  // 酷狗音乐支持的基础音质，为基础音质提供支持
  const commonQualities = ['128k', '320k', 'flac'];
  commonQualities.forEach(quality => {
    qualities[quality] = {};
  });
  
  return {
    id: _.hash,
    title: _.songname,
    artist:
      (_a = _.singername) !== null && _a !== void 0
        ? _a
        : ((_c =
            (_b = _.authors) === null || _b === void 0
              ? void 0
              : _b.map((_) => {
                  var _a;
                  return (_a =
                    _ === null || _ === void 0 ? void 0 : _.author_name) !==
                    null && _a !== void 0
                    ? _a
                    : "";
                })) === null || _c === void 0
            ? void 0
            : _c.join(", ")) ||
          ((_f =
            (_e =
              (_d = _.filename) === null || _d === void 0
                ? void 0
                : _d.split("-")) === null || _e === void 0
              ? void 0
              : _e[0]) === null || _f === void 0
            ? void 0
            : _f.trim()),
    album: (_g = _.album_name) !== null && _g !== void 0 ? _g : _.remark,
    album_id: _.album_id,
    album_audio_id: _.album_audio_id,
    artwork: _.album_sizable_cover
      ? _.album_sizable_cover.replace("{size}", "400")
      : undefined,
    duration: _.duration,
    "320hash": _["320hash"],
    sqhash: _.sqhash,
    origin_hash: _.origin_hash,
    qualities: qualities,
  };
}
function formatImportMusicItem(_) {
  var _a, _b, _c, _d, _e, _f, _g;
  let title = _.name;
  const singerName = _.singername;
  if (singerName && title) {
    const index = title.indexOf(singerName);
    if (index !== -1) {
      title =
        (_a = title.substring(index + singerName.length + 2)) === null ||
        _a === void 0
          ? void 0
          : _a.trim();
    }
    if (!title) {
      title = singerName;
    }
  }
  const qualites = _.relate_goods;
  return {
    id: _.hash,
    title,
    artist: singerName,
    album: (_b = _.albumname) !== null && _b !== void 0 ? _b : "",
    album_id: _.album_id,
    album_audio_id: _.album_audio_id,
    artwork:
      (_d =
        (_c = _ === null || _ === void 0 ? void 0 : _.info) === null ||
        _c === void 0
          ? void 0
          : _c.image) === null || _d === void 0
        ? void 0
        : _d.replace("{size}", "400"),
    "320hash":
      (_e = qualites === null || qualites === void 0 ? void 0 : qualites[1]) ===
        null || _e === void 0
        ? void 0
        : _e.hash,
    sqhash:
      (_f = qualites === null || qualites === void 0 ? void 0 : qualites[2]) ===
        null || _f === void 0
        ? void 0
        : _f.hash,
    origin_hash:
      (_g = qualites === null || qualites === void 0 ? void 0 : qualites[3]) ===
        null || _g === void 0
        ? void 0
        : _g.hash,
  };
}
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "zh-CN,zh;q=0.9",
};
async function searchMusic(query, page) {
  const res = (
    await axios_1.default.get("https://songsearch.kugou.com/song_search_v2", {
      headers,
      params: {
        keyword: query,
        page,
        pagesize: pageSize,
        userid: 0,
        clientver: "",
        platform: "WebFilter",
        filter: 2,
        iscorrection: 1,
        privilege_filter: 0,
        area_code: 1,
      },
    })
  ).data;
  
  const songList = res.data.lists;
  
  // 提取hash列表用于批量获取音质信息
  const hashList = songList.map(item => {
    var _a;
    return (_a = item.FileHash) !== null && _a !== void 0 ? _a : item.Grp[0].FileHash;
  }).filter(hash => hash);
  
  // 批量获取音质信息
  let qualityInfoMap = {};
  try {
    qualityInfoMap = await getBatchMusicQualityInfo(hashList);
  } catch (error) {
    console.error('Failed to get quality info for KuGou search:', error);
  }
  
  const songs = songList.map(song => formatMusicItem(song, qualityInfoMap));
  
  return {
    isEnd: page * pageSize >= res.data.total,
    data: songs,
  };
}
async function searchAlbum(query, page) {
  const res = (
    await axios_1.default.get("http://msearch.kugou.com/api/v3/search/album", {
      headers,
      params: {
        version: 9108,
        iscorrection: 1,
        highlight: "em",
        plat: 0,
        keyword: query,
        pagesize: 20,
        page,
        sver: 2,
        with_res_tag: 0,
      },
    })
  ).data;
  const albums = res.data.info.map((_) => {
    var _a, _b;
    return {
      id: _.albumid,
      artwork:
        (_a = _.imgurl) === null || _a === void 0
          ? void 0
          : _a.replace("{size}", "400"),
      artist: _.singername,
      title: (0, cheerio_1.load)(_.albumname).text(),
      description: _.intro,
      date:
        (_b = _.publishtime) === null || _b === void 0
          ? void 0
          : _b.slice(0, 10),
    };
  });
  return {
    isEnd: page * 20 >= res.data.total,
    data: albums,
  };
}
async function searchMusicSheet(query, page) {
  const res = (
    await axios_1.default.get(
      "http://mobilecdn.kugou.com/api/v3/search/special",
      {
        headers,
        params: {
          format: "json",
          keyword: query,
          page,
          pagesize: pageSize,
          showtype: 1,
        },
      }
    )
  ).data;
  const sheets = res.data.info.map((item) => ({
    title: item.specialname,
    createAt: item.publishtime,
    description: item.intro,
    artist: item.nickname,
    coverImg: item.imgurl,
    gid: item.gid,
    playCount: item.playcount,
    id: item.specialid,
    worksNum: item.songcount,
  }));
  return {
    isEnd: page * pageSize >= res.data.total,
    data: sheets,
  };
}
async function searchArtist(query, page) {
  try {
    const res = (
      await axios_1.default.get("http://mobilecdn.kugou.com/api/v3/search/singer", {
        headers,
        params: {
          version: 9108,
          keyword: query,
          page,
          pagesize: pageSize,
          singingtype: -100,
          accuracy: 1,
          istag: 1,
          area_code: 1,
        },
      })
    ).data;
    
    // 检查响应结构
    if (!res || res.status !== 1 || !res.data) {
      console.error('[酷狗] 歌手搜索失败:', res);
      return {
        isEnd: true,
        data: [],
      };
    }
    
    // 数据直接在res.data数组中
    const artists = res.data.map((_) => ({
      name: _.singername,
      id: _.singerid,
      avatar: _.sizeablesingerimg ? _.sizeablesingerimg.replace("{size}", "400") : undefined,
      worksNum: _.songcount || 0,
    }));
    
    return {
      isEnd: res.data.length < pageSize,
      data: artists,
    };
  } catch (error) {
    console.error('[酷狗] 歌手搜索异常:', error.message);
    return {
      isEnd: true,
      data: [],
    };
  }
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
    // 优先使用flac的hash，如果没有则使用歌曲id
    let songId = musicItem.sqhash || musicItem.id;

    const res = (
      await axios_1.default.get(
        `${API_URL}/url?source=kg&songId=${songId}&quality=${qualityLevels[quality]}`,
        {
          "headers": {
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
      console.error(`[酷狗] 获取播放链接失败: ${res.msg || '未知错误'}`);
      return null;
    }
  } catch (error) {
    console.error(`[酷狗] 获取播放源错误: ${error.message}`);
    throw error;
  }
}
async function getTopLists() {
  const lists = (
    await axios_1.default.get(
      "http://mobilecdnbj.kugou.com/api/v3/rank/list?version=9108&plat=0&showtype=2&parentid=0&apiver=6&area_code=1&withsong=0&with_res_tag=0",
      {
        headers: headers,
      }
    )
  ).data.data.info;
  const res = [
    {
      title: "热门榜单",
      data: [],
    },
    {
      title: "特色音乐榜",
      data: [],
    },
    {
      title: "全球榜",
      data: [],
    },
  ];
  const extra = {
    title: "其他",
    data: [],
  };
  lists.forEach((item) => {
    var _a, _b, _c, _d;
    if (item.classify === 1 || item.classify === 2) {
      res[0].data.push({
        id: item.rankid,
        description: item.intro,
        coverImg:
          (_a = item.imgurl) === null || _a === void 0
            ? void 0
            : _a.replace("{size}", "400"),
        title: item.rankname,
      });
    } else if (item.classify === 3 || item.classify === 5) {
      res[1].data.push({
        id: item.rankid,
        description: item.intro,
        coverImg:
          (_b = item.imgurl) === null || _b === void 0
            ? void 0
            : _b.replace("{size}", "400"),
        title: item.rankname,
      });
    } else if (item.classify === 4) {
      res[2].data.push({
        id: item.rankid,
        description: item.intro,
        coverImg:
          (_c = item.imgurl) === null || _c === void 0
            ? void 0
            : _c.replace("{size}", "400"),
        title: item.rankname,
      });
    } else {
      extra.data.push({
        id: item.rankid,
        description: item.intro,
        coverImg:
          (_d = item.imgurl) === null || _d === void 0
            ? void 0
            : _d.replace("{size}", "400"),
        title: item.rankname,
      });
    }
  });
  if (extra.data.length !== 0) {
    res.push(extra);
  }
  return res;
}
async function getTopListDetail(topListItem) {
  const res = await axios_1.default.get(
    `http://mobilecdnbj.kugou.com/api/v3/rank/song?version=9108&ranktype=0&plat=0&pagesize=100&area_code=1&page=1&volid=35050&rankid=${topListItem.id}&with_res_tag=0`,
    {
      headers,
    }
  );
  return Object.assign(Object.assign({}, topListItem), {
    musicList: res.data.data.info.map(formatMusicItem2),
  });
}
async function getLyricDownload(lyrdata) {
  const result = (
    await (0, axios_1.default)({
      // url: `http://lyrics.kugou.com/download?ver=1&client=pc&id=${lyrdata.id}&accesskey=${lyrdata.accessKey}&fmt=krc&charset=utf8`,
      url: `http://lyrics.kugou.com/download?ver=1&client=pc&id=${lyrdata.id}&accesskey=${lyrdata.accessKey}&fmt=lrc&charset=utf8`,
      headers: {
        "KG-RC": 1,
        "KG-THash": "expand_search_manager.cpp:852736169:451",
        "User-Agent": "KuGou2012-9020-ExpandSearchManager",
      },
      method: "get",
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  return {
    rawLrc: he.decode(
      CryptoJs.enc.Base64.parse(result.content).toString(CryptoJs.enc.Utf8)
    ),
  };
}
// copy from lxmusic https://github.com/lyswhut/lx-music-desktop/blob/master/src/renderer/utils/musicSdk/kg/lyric.js#L114
async function getLyric(musicItem) {
  const result = (
    await (0, axios_1.default)({
      url: `http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=${musicItem.title}&hash=${musicItem.id}&timelength=${musicItem.duration}`,
      headers: {
        "KG-RC": 1,
        "KG-THash": "expand_search_manager.cpp:852736169:451",
        "User-Agent": "KuGou2012-9020-ExpandSearchManager",
      },
      method: "get",
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })
  ).data;
  const info = result.candidates[0];
  return await getLyricDownload({ id: info.id, accessKey: info.accesskey });
}
async function getAlbumInfo(albumItem, page = 1) {
  const res = (
    await axios_1.default.get("http://mobilecdn.kugou.com/api/v3/album/song", {
      params: {
        version: 9108,
        albumid: albumItem.id,
        plat: 0,
        pagesize: 100,
        area_code: 1,
        page,
        with_res_tag: 0,
      },
    })
  ).data;
  return {
    isEnd: page * 100 >= res.data.total,
    albumItem: {
      worksNum: res.data.total,
    },
    musicList: res.data.info.map((_) => {
      var _a;
      const [artist, songname] = _.filename.split("-");
      return {
        id: _.hash,
        title: songname.trim(),
        artist: artist.trim(),
        album: (_a = _.album_name) !== null && _a !== void 0 ? _a : _.remark,
        album_id: _.album_id,
        album_audio_id: _.album_audio_id,
        artwork: albumItem.artwork,
        "320hash": _.HQFileHash,
        sqhash: _.SQFileHash,
        origin_hash: _.id,
      };
    }),
  };
}
// 格式化歌手歌曲列表项
function formatArtistSongItem(_) {
  var _a;
  
  // 构建基础音质对象
  const qualities = {};
  const basicQualities = ['128k', '320k', 'flac'];
  basicQualities.forEach(quality => {
    qualities[quality] = {};
  });
  
  // 从filename中提取歌手和歌曲名
  let artist = "";
  let title = "";
  if (_.filename) {
    const parts = _.filename.split("-");
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join("-").replace(/\.mp3$/i, "").trim();
    } else {
      title = _.filename.replace(/\.mp3$/i, "").trim();
    }
  }
  
  return {
    id: _.hash,
    title: title || _.songname || "未知歌曲",
    artist: artist || _.singername || "未知歌手",
    album: (_a = _.album_name) !== null && _a !== void 0 ? _a : _.remark,
    album_id: _.album_id,
    album_audio_id: _.album_audio_id,
    artwork: _.album_sizable_cover
      ? _.album_sizable_cover.replace("{size}", "400")
      : undefined,
    duration: _.duration,
    "320hash": _.HQFileHash || _["320hash"],
    sqhash: _.SQFileHash || _.sqhash,
    origin_hash: _.origin_hash,
    qualities: qualities,
  };
}

// 创建签名函数
function signatureParams(params, platform = 'android', body = '') {
  const CryptoJS = require('crypto-js');
  const key = platform === 'android' ? 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt' : 'OGlhb_mGjkNRpgBPgvkuf6L_taKhYTVi';
  const str = params + (body ? JSON.stringify(body) : '') + key;
  return CryptoJS.MD5(str).toString();
}

// 处理global_collection_id类型的歌单
async function getUserListDetail2(global_collection_id) {
  const id = global_collection_id;
  if (id.length > 1000) throw new Error('[酷狗] global_collection_id无效');
  
  try {
    // 获取歌单信息
    const params = 
      'appid=1058&specialid=0&global_specialid=' + id + 
      '&format=jsonp&srcappid=2919&clientver=20000&clienttime=1586163242519&mid=1586163242519&uuid=1586163242519&dfid=-';
    
    const infoRes = await axios_1.default.get(
      `https://mobiles.kugou.com/api/v5/special/info_v2?${params}&signature=${signatureParams(params, 'web')}`,
      {
        headers: {
          mid: '1586163242519',
          Referer: 'https://m3ws.kugou.com/share/index.php',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
          dfid: '-',
          clienttime: '1586163242519',
        },
      }
    );
    
    if (!infoRes.data || !infoRes.data.data) {
      console.error('[酷狗] 获取歌单信息失败');
      return [];
    }
    
    const info = infoRes.data.data;
    const songcount = info.songcount || 100;
    
    // 分页获取歌曲列表
    const tasks = [];
    let page = 0;
    let total = songcount;
    
    while (total > 0) {
      const limit = total > 300 ? 300 : total;
      total -= limit;
      page += 1;
      
      const pageParams = 
        'appid=1058&global_specialid=' + id + 
        '&specialid=0&plat=0&version=8000&page=' + page + 
        '&pagesize=' + limit + 
        '&srcappid=2919&clientver=20000&clienttime=1586163263991&mid=1586163263991&uuid=1586163263991&dfid=-';
      
      tasks.push(
        axios_1.default.get(
          `https://mobiles.kugou.com/api/v5/special/song_v2?${pageParams}&signature=${signatureParams(pageParams, 'web')}`,
          {
            headers: {
              mid: '1586163263991',
              Referer: 'https://m3ws.kugou.com/share/index.php',
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
              dfid: '-',
              clienttime: '1586163263991',
            },
          }
        ).then(res => res.data.data.info)
      );
    }
    
    // 获取所有歌曲信息
    const songInfos = await Promise.all(tasks).then(results => results.flat());
    
    // 获取详细歌曲信息
    let resource = songInfos.map((song) => ({
      album_audio_id: 0,
      album_id: "0",
      hash: song.hash,
      id: 0,
      name: song.filename ? song.filename.replace(".mp3", "") : "",
      page_id: 0,
      type: "audio",
    }));
    
    let postData = {
      appid: 1001,
      area_code: "1",
      behavior: "play",
      clientver: "10112",
      dfid: "2O3jKa20Gdks0LWojP3ly7ck",
      mid: "70a02aad1ce4648e7dca77f2afa7b182",
      need_hash_offset: 1,
      relate: 1,
      resource,
      token: "",
      userid: "0",
      vip: 0,
    };
    
    const detailResult = await axios_1.default.post(
      `https://gateway.kugou.com/v2/get_res_privilege/lite?appid=1001&clienttime=1668883879&clientver=10112&dfid=2O3jKa20Gdks0LWojP3ly7ck&mid=70a02aad1ce4648e7dca77f2afa7b182&userid=390523108&uuid=92691C6246F86F28B149BAA1FD370DF1`,
      postData,
      {
        headers: {
          "x-router": "media.store.kugou.com",
        },
      }
    );
    
    if (detailResult.status === 200 && detailResult.data && detailResult.data.status === 1 && detailResult.data.data) {
      console.log(`[酷狗] 通过global_collection_id获取歌曲详情成功，数量: ${detailResult.data.data.length}`);
      
      // 获取hash列表用于批量获取音质信息
      const hashList = detailResult.data.data.map(item => item.hash).filter(Boolean);
      
      // 音质信息获取是可选的，失败不影响歌单导入
      let qualityInfoMap = {};
      try {
        if (hashList.length > 0) {
          qualityInfoMap = await getBatchMusicQualityInfo(hashList);
        }
      } catch (err) {
        console.warn('[酷狗] 获取音质信息失败，使用默认音质:', err.message);
      }
      
      // 格式化歌单项并附加音质信息
      const musicList = detailResult.data.data.map(item => {
        const formattedItem = formatImportMusicItem(item);
        // 添加音质信息
        if (qualityInfoMap[item.hash]) {
          formattedItem.qualities = qualityInfoMap[item.hash];
        } else {
          // 如果没有获取到音质信息，提供基础音质
          formattedItem.qualities = {
            '128k': {},
            '320k': {},
            'flac': {}
          };
        }
        return formattedItem;
      });
      
      console.log(`[酷狗] 歌单导入成功（global_collection_id），最终歌曲数量: ${musicList.length}`);
      return musicList;
    }
    
    return [];
  } catch (error) {
    console.error(`[酷狗] getUserListDetail2异常: ${error.message}`);
    return [];
  }
}

async function getArtistWorks(artistItem, page, type) {
  if (type === "music") {
    const res = (
      await axios_1.default.get(
        "http://mobilecdn.kugou.com/api/v3/singer/song",
        {
          headers,
          params: {
            version: 9108,
            singerid: artistItem.id,
            page,
            pagesize: 100,
            sorttype: 1,
            area_code: 1,
          },
        }
      )
    ).data;
    return {
      isEnd: page * 100 >= res.data.total,
      data: res.data.info.map(formatArtistSongItem),
    };
  } else if (type === "album") {
    const res = (
      await axios_1.default.get(
        "http://mobilecdn.kugou.com/api/v3/singer/album",
        {
          headers,
          params: {
            version: 9108,
            singerid: artistItem.id,
            page,
            pagesize: 20,
            area_code: 1,
          },
        }
      )
    ).data;
    return {
      isEnd: page * 20 >= res.data.total,
      data: res.data.info.map((_) => ({
        id: _.albumid,
        title: _.albumname,
        artwork: _.img ? _.img.replace("{size}", "400") : undefined,
        date: _.publishtime ? _.publishtime.slice(0, 10) : undefined,
        artist: artistItem.name,
      })),
    };
  }
}

async function getMusicSheetInfo(sheet, page) {
  try {
    // 处理各种输入格式
    let sheetId = sheet.id || sheet;
    
    // 去除可能的前缀
    if (typeof sheetId === 'string' && sheetId.startsWith('id_')) {
      sheetId = sheetId.replace('id_', '');
    }
    
    console.log(`[酷狗] 开始获取歌单详情，ID: ${sheetId}, 页码: ${page}`);
    
    // 如果是字符串形式的specialid，直接使用特定API获取歌单
    if (sheetId && /^\d+$/.test(sheetId.toString())) {
      return await getSpecialMusicList(sheetId, page);
    }
    
    // 否则尝试作为酷狗码导入
    const musicList = await importMusicSheet(sheetId);
    
    // 如果importMusicSheet返回空，尝试其他方式
    if (!musicList || musicList.length === 0) {
      console.log('[酷狗] 歌单为空，尝试解析其他格式');
      
      // 尝试作为URL处理
      if (typeof sheetId === 'string' && sheetId.includes('http')) {
        return {
          isEnd: true,
          musicList: [],
        };
      }
    }
    
    // 分页处理
    const pageSize = 100;
    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;
    const pagedList = musicList ? musicList.slice(startIndex, endIndex) : [];
    
    return {
      isEnd: !musicList || musicList.length <= endIndex,
      musicList: pagedList,
    };
  } catch (error) {
    console.error('[酷狗] 获取歌单详情失败:', error);
    return {
      isEnd: true,
      musicList: [],
    };
  }
}

// 使用specialid获取歌单
async function getSpecialMusicList(specialId, page) {
  try {
    const pageSize = 100;
    
    // 获取歌单详细信息
    const infoRes = await axios_1.default.get(
      `http://mobilecdn.kugou.com/api/v3/special/song`,
      {
        headers: headers,
        params: {
          version: 9108,
          specialid: specialId,
          page,
          pagesize: pageSize,
          plat: 0,
          area_code: 1,
          with_res_tag: 0,
        },
      }
    );
    
    if (!infoRes.data || infoRes.data.status !== 1 || !infoRes.data.data) {
      console.error('[酷狗] 获取歌单信息失败');
      return {
        isEnd: true,
        musicList: [],
      };
    }
    
    const data = infoRes.data.data;
    const songs = data.info || [];
    
    // 提取hash列表用于批量获取音质信息
    const hashList = songs.map(item => item.hash).filter(Boolean);
    
    // 批量获取音质信息
    let qualityInfoMap = {};
    try {
      if (hashList.length > 0) {
        qualityInfoMap = await getBatchMusicQualityInfo(hashList);
      }
    } catch (error) {
      console.error('[酷狗] 获取音质信息失败，使用默认音质:', error.message);
    }
    
    // 格式化歌曲列表
    const musicList = songs.map((song) => {
      // 从filename中提取歌手和歌曲名
      let artist = "";
      let title = "";
      if (song.filename) {
        const parts = song.filename.split("-");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join("-").replace(/\.mp3$/i, "").trim();
        } else {
          title = song.filename.replace(/\.mp3$/i, "").trim();
        }
      }
      
      // 获取音质信息
      const qualities = qualityInfoMap[song.hash] || {
        '128k': {},
        '320k': {},
        'flac': {}
      };
      
      return {
        id: song.hash,
        title: title || song.songname || "未知歌曲",
        artist: artist || song.singername || "未知歌手",
        album: song.album_name || "",
        album_id: song.album_id,
        album_audio_id: song.album_audio_id,
        duration: song.duration,
        "320hash": song["320hash"],
        sqhash: song.sqhash,
        origin_hash: song.origin_hash,
        qualities: qualities,
      };
    });
    
    console.log(`[酷狗] 获取歌单成功，歌曲数量: ${musicList.length}`);
    
    return {
      isEnd: page * pageSize >= data.total,
      musicList: musicList,
    };
  } catch (error) {
    console.error('[酷狗] 获取歌单详情异常:', error.message);
    return {
      isEnd: true,
      musicList: [],
    };
  }
}

async function importMusicSheet(urlLike) {
  var _a;
  let id =
    (_a = urlLike.match(/^(?:.*?)(\d+)(?:.*?)$/)) === null || _a === void 0
      ? void 0
      : _a[1];
  let musicList = [];
  
  if (!id) {
    console.error('[酷狗] 无法解析酷狗码，请输入纯数字酷狗码');
    return musicList;
  }
  
  console.log(`[酷狗] 开始导入歌单，酷狗码: ${id}`);
  
  try {
    // 第一步：获取歌单基本信息
    let res = await axios_1.default.post(`http://t.kugou.com/command/`, {
      appid: 1001,
      clientver: 9020,
      mid: "21511157a05844bd085308bc76ef3343",
      clienttime: 640612895,
      key: "36164c4015e704673c588ee202b9ecb8",
      data: id,
    });
    
    if (res.status !== 200 || !res.data || res.data.status !== 1 || !res.data.data) {
      console.error(`[酷狗] 获取歌单基本信息失败: ${res.data ? res.data.message || res.data.error || '未知错误' : '无返回数据'}`);
      return musicList;
    }
    
    let data = res.data.data;
    let info = data.info;
    
    if (!info) {
      console.error('[酷狗] 歌单信息为空');
      return musicList;
    }
    
    console.log(`[酷狗] 歌单基本信息获取成功，类型: ${info.type}, 歌曲数量: ${info.count}`);
    
    // type: 1单曲，2歌单，3电台，4酷狗码，5别人的播放队列
    // 如果是歌单类型但有 global_collection_id，使用另外的接口
    if (info.type === 2 && info.global_collection_id) {
      console.log(`[酷狗] 检测到global_collection_id: ${info.global_collection_id}，使用特殊接口获取歌单`);
      return await getUserListDetail2(info.global_collection_id);
    }
    
    // 如果有list字段，直接使用
    if (res.data.data.list && res.data.data.list.length > 0) {
      console.log(`[酷狗] 直接获取到歌曲列表，数量: ${res.data.data.list.length}`);
      // 构建资源列表用于获取详细信息
      let resource = res.data.data.list.map((song) => ({
        album_audio_id: 0,
        album_id: "0",
        hash: song.hash,
        id: 0,
        name: song.filename ? song.filename.replace(".mp3", "") : "",
        page_id: 0,
        type: "audio",
      }));
      
      // 获取歌曲详细信息
      let postData = {
        appid: 1001,
        area_code: "1",
        behavior: "play",
        clientver: "10112",
        dfid: "2O3jKa20Gdks0LWojP3ly7ck",
        mid: "70a02aad1ce4648e7dca77f2afa7b182",
        need_hash_offset: 1,
        relate: 1,
        resource,
        token: "",
        userid: "0",
        vip: 0,
      };
      
      let detailResult = await axios_1.default.post(
        `https://gateway.kugou.com/v2/get_res_privilege/lite?appid=1001&clienttime=1668883879&clientver=10112&dfid=2O3jKa20Gdks0LWojP3ly7ck&mid=70a02aad1ce4648e7dca77f2afa7b182&userid=390523108&uuid=92691C6246F86F28B149BAA1FD370DF1`,
        postData,
        {
          headers: {
            "x-router": "media.store.kugou.com",
          },
        }
      );
      
      if (detailResult.status === 200 && detailResult.data && detailResult.data.status === 1 && detailResult.data.data) {
        console.log(`[酷狗] 获取歌曲详情成功，数量: ${detailResult.data.data.length}`);
        
        // 获取hash列表用于批量获取音质信息
        const hashList = detailResult.data.data.map(item => item.hash).filter(Boolean);
        
        // 音质信息获取是可选的，失败不影响歌单导入
        let qualityInfoMap = {};
        try {
          if (hashList.length > 0) {
            qualityInfoMap = await getBatchMusicQualityInfo(hashList);
          }
        } catch (err) {
          console.warn('[酷狗] 获取音质信息失败，使用默认音质:', err.message);
        }
        
        // 格式化歌单项并附加音质信息
        musicList = detailResult.data.data.map(item => {
          const formattedItem = formatImportMusicItem(item);
          // 添加音质信息
          if (qualityInfoMap[item.hash]) {
            formattedItem.qualities = qualityInfoMap[item.hash];
          } else {
            // 如果没有获取到音质信息，提供基础音质
            formattedItem.qualities = {
              '128k': {},
              '320k': {},
              'flac': {}
            };
          }
          return formattedItem;
        });
        
        console.log(`[酷狗] 歌单导入成功（从list字段），最终歌曲数量: ${musicList.length}`);
        return musicList;
      }
    }
    
    // 第二步：如果没有直接的list，则需要通过另外的接口获取
    if (info.userid != null && info.id) {
      console.log(`[酷狗] 使用userid方式获取歌单，userid: ${info.userid}, id: ${info.id}`);
      
      let response = await axios_1.default.post(
        `http://www2.kugou.kugou.com/apps/kucodeAndShare/app/`,
        {
          appid: 1001,
          clientver: 10112,
          mid: "70a02aad1ce4648e7dca77f2afa7b182",
          clienttime: 722219501,
          key: "381d7062030e8a5a94cfbe50bfe65433",
          data: {
            id: info.id,
            type: 3,
            userid: info.userid,
            collect_type: info.collect_type || 0,
            page: 1,
            pagesize: info.count || 100,
          },
        }
      );
      
      if (response.status === 200 && response.data) {
        // 检查返回数据
        let songData = response.data;
        
        // 处理返回的数据结构可能不同的情况
        if (songData.status === 1 && songData.data) {
          songData = songData.data;
        }
        
        if (Array.isArray(songData) && songData.length > 0) {
          console.log(`[酷狗] 获取到歌单歌曲列表，数量: ${songData.length}`);
          
          let resource = [];
          songData.forEach((song) => {
            resource.push({
              album_audio_id: 0,
              album_id: "0",
              hash: song.hash,
              id: 0,
              name: song.filename ? song.filename.replace(".mp3", "") : "",
              page_id: 0,
              type: "audio",
            });
          });
          
          let postData = {
            appid: 1001,
            area_code: "1",
            behavior: "play",
            clientver: "10112",
            dfid: "2O3jKa20Gdks0LWojP3ly7ck",
            mid: "70a02aad1ce4648e7dca77f2afa7b182",
            need_hash_offset: 1,
            relate: 1,
            resource,
            token: "",
            userid: "0",
            vip: 0,
          };
          
          var result = await axios_1.default.post(
            `https://gateway.kugou.com/v2/get_res_privilege/lite?appid=1001&clienttime=1668883879&clientver=10112&dfid=2O3jKa20Gdks0LWojP3ly7ck&mid=70a02aad1ce4648e7dca77f2afa7b182&userid=390523108&uuid=92691C6246F86F28B149BAA1FD370DF1`,
            postData,
            {
              headers: {
                "x-router": "media.store.kugou.com",
              },
            }
          );
          
          if (result.status === 200 && result.data && result.data.status === 1 && result.data.data) {
            console.log(`[酷狗] 获取歌曲详情成功，数量: ${result.data.data.length}`);
            
            // 获取hash列表用于批量获取音质信息
            const hashList = result.data.data.map(item => item.hash).filter(Boolean);
            
            // 音质信息获取是可选的，失败不影响歌单导入
            let qualityInfoMap = {};
            try {
              if (hashList.length > 0) {
                qualityInfoMap = await getBatchMusicQualityInfo(hashList);
              }
            } catch (err) {
              console.warn('[酷狗] 获取音质信息失败，使用默认音质:', err.message);
            }
            
            // 格式化歌单项并附加音质信息
            musicList = result.data.data.map(item => {
              const formattedItem = formatImportMusicItem(item);
              // 添加音质信息
              if (qualityInfoMap[item.hash]) {
                formattedItem.qualities = qualityInfoMap[item.hash];
              } else {
                // 如果没有获取到音质信息，提供基础音质
                formattedItem.qualities = {
                  '128k': {},
                  '320k': {},
                  'flac': {}
                };
              }
              return formattedItem;
            });
            
            console.log(`[酷狗] 歌单导入成功，最终歌曲数量: ${musicList.length}`);
          } else {
            console.error(`[酷狗] 获取歌曲详情失败: ${result.data ? result.data.message || result.data.error || '未知错误' : '无返回数据'}`);
          }
        } else {
          console.error(`[酷狗] 歌单歌曲列表为空或格式错误`);
        }
      } else {
        console.error(`[酷狗] 获取歌单列表失败: ${response.data ? response.data.message || response.data.error || '未知错误' : '无返回数据'}`);
      }
    } else {
      console.error(`[酷狗] 无法获取歌单，缺少必要信息: userid=${info.userid}, id=${info.id}`);
    }
  } catch (error) {
    console.error(`[酷狗] 导入歌单异常: ${error.message}`);
  }
  
  return musicList;
}
module.exports = {
  platform: "酷狗音乐",
  version: "0.2.0",
  author: "Toskysun",
  appVersion: ">0.1.0-alpha.0",
  srcUrl: UPDATE_URL,
  cacheControl: "no-cache",
  // 声明插件支持的音质列表
  supportedQualities: ["128k", "320k", "flac", "flac24bit", "hires", "atmos", "master"],
  primaryKey: ["id", "album_id", "album_audio_id"],
  hints: {
    importMusicSheet: [
      "仅支持酷狗APP通过酷狗码导入，输入纯数字酷狗码即可。",
      "导入时间和歌单大小有关，请耐心等待",
    ],
  },
  supportedSearchType: ["music", "album", "sheet", "artist"],
  async search(query, page, type) {
    if (type === "music") {
      return await searchMusic(query, page);
    } else if (type === "album") {
      return await searchAlbum(query, page);
    } else if (type === "sheet") {
      return await searchMusicSheet(query, page);
    } else if (type === "artist") {
      return await searchArtist(query, page);
    }
  },
  getMediaSource,
  getTopLists,
  getLyric,
  getTopListDetail,
  getAlbumInfo,
  getArtistWorks,
  importMusicSheet,
  getMusicSheetInfo,
};
