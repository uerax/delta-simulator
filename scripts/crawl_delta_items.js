/**
 * 三角洲行动（Delta Force）官方百科物资道具爬虫
 * 目标页面: https://www.playdeltaforce.com/act/officialwiki/zh-tw/#/item/consume
 *
 * 严格按需爬取范围:
 *  1. 收藏品 (collection)
 *  2. 消耗品 (consume)
 *  3. 门卡 (key)
 * 提取核心字段:
 *  - 道具图片 (高清原图下载至本地及记录 URL)
 *  - 大小 (占格子 width x length, 如 1x1, 1x2, 2x2 等)
 *  - 重量 (kg)
 *  - 名字 (繁体官方名 + 简体对照名)
 *  - 品质、描述及详情
 */

const fs = require('fs');
const path = require('path');

// 加载本地 OpenCC 权威繁简转换器
const openccPath = path.resolve(__dirname, './lib/opencc.js');
const openccCode = fs.readFileSync(openccPath, 'utf-8');
const openccCtx = {};
new Function('exports', 'module', openccCode)(openccCtx, { exports: openccCtx });
const openccConverter = openccCtx.Converter({ from: 'tw', to: 'cn' });

function toSimplifiedChinese(str) {
  if (!str) return '';
  return openccConverter(str);
}

// 稀有度与等级完整映射体系 (6级=红, 5级=橙, 4级=紫, 3级=蓝, 2级=绿, 1级=白)
const RARITY_MAP = {
  6: {
    level: 6,
    color: '红',
    rarity: '红',
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    iconClass: 'item-level-icon img_levelicon_06'
  },
  5: {
    level: 5,
    color: '橙',
    rarity: '橙',
    colorHex: '#F59E0B',
    bgColorHex: '#37281b',
    iconClass: 'item-level-icon img_levelicon_05'
  },
  4: {
    level: 4,
    color: '紫',
    rarity: '紫',
    colorHex: '#9333EA',
    bgColorHex: '#1e1c2c',
    iconClass: 'item-level-icon img_levelicon_04'
  },
  3: {
    level: 3,
    color: '蓝',
    rarity: '蓝',
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    iconClass: 'item-level-icon img_levelicon_03'
  },
  2: {
    level: 2,
    color: '绿',
    rarity: '绿',
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    iconClass: 'item-level-icon img_levelicon_02'
  },
  1: {
    level: 1,
    color: '白',
    rarity: '白',
    colorHex: '#9CA3AF',
    bgColorHex: '#1e2222',
    iconClass: 'item-level-icon img_levelicon_01'
  }
};

// 目标分类与映射
const TARGET_CATEGORIES = {
  'collection': { key: 'collection', name: '收藏品', folder: 'collection' },
  'consume': { key: 'consume', name: '消耗品', folder: 'consume' },
  'key': { key: 'key', name: '门卡', folder: 'keys' }
};

// 官方接口配置
const API_URL = 'https://sg-apps.vasdgame.com/ide/';
const LANG_PACK_URL = 'https://deltaforcewiki.vasdgame.com/playerhub/40001/language/language_zh-tw_2025012019.json';

// 输出目录配置
const BASE_ASSETS_DIR = path.resolve(__dirname, '../miniprogram/assets/items');
const MANIFEST_PATH = path.join(BASE_ASSETS_DIR, 'item_manifest.json');

async function fetchOfficialProps() {
  console.log('1. 请求三角洲官方百科道具接口 (primary: props)...');
  const params = new URLSearchParams({
    iChartId: '100005405',
    sIdeToken: 'nkxYQl',
    instanceid: '4005360',
    method: 'projectd_oversea/object.list',
    param: JSON.stringify({ primary: 'props', second: '', third: '', objectID: '' }),
    sLanguage: 'zh-tw'
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'referer': 'https://www.playdeltaforce.com/',
      'origin': 'https://www.playdeltaforce.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: params.toString()
  });

  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const json = await res.json();
  if (json.ret !== 0 && json.iRet !== 0) throw new Error(`API ret error: ${JSON.stringify(json)}`);

  const rawList = json.jData?.data?.data?.list || [];
  console.log(`- 官方返回道具总条目数: ${rawList.length}`);
  return rawList;
}

async function fetchLanguagePack() {
  console.log('2. 获取官方最新动态多语言字典 (zh-tw)...');
  const res = await fetch(LANG_PACK_URL, {
    headers: { 'user-agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Fetch language pack failed: ${res.status}`);
  const dict = await res.json();
  console.log(`- 语言字典包含词条数: ${Object.keys(dict).length}`);
  return dict;
}

function normalizePicUrl(url) {
  if (!url) return '';
  // 规范化双斜杠（排除协议头的 http:// 或 https://）
  return url.replace(/([^:])\/{2,}/g, '$1/');
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

// 限制并发下载辅助函数
async function downloadPool(tasks, concurrency = 10) {
  let index = 0;
  let successCount = 0;
  let failCount = 0;
  const total = tasks.length;

  async function worker() {
    while (index < tasks.length) {
      const currentTask = tasks[index++];
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await currentTask();
          success = true;
          successCount++;
          break;
        } catch (e) {
          if (attempt === 3) {
            failCount++;
            console.error(`- 下载重试失败 (${attempt}/3):`, e.message);
          } else {
            await new Promise(r => setTimeout(r, 500 * attempt));
          }
        }
      }
      if (index % 30 === 0 || index === total) {
        process.stdout.write(`\r- 图片下载进度: ${index}/${total} (成功: ${successCount}, 失败: ${failCount})`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  console.log('');
  return { successCount, failCount };
}

async function main() {
  console.log('=== 三角洲行动物资道具爬虫启动 ===');
  const startTime = Date.now();

  // 确保基础目录存在
  if (!fs.existsSync(BASE_ASSETS_DIR)) {
    fs.mkdirSync(BASE_ASSETS_DIR, { recursive: true });
  }
  for (const cat of Object.values(TARGET_CATEGORIES)) {
    const dir = path.join(BASE_ASSETS_DIR, cat.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 1. 获取道具数据与语言包
  const [rawItems, langDict] = await Promise.all([
    fetchOfficialProps(),
    fetchLanguagePack()
  ]);

  // 2. 严格按需过滤: 仅保留 收藏品、消耗品、门卡
  const filteredItems = rawItems.filter(item => TARGET_CATEGORIES[item.secondClass]);
  console.log(`3. 按需筛选完成，目标道具总数: ${filteredItems.length} (已严格排除其它分类)`);

  const categoryStats = {
    collection: 0,
    consume: 0,
    key: 0
  };

  const parsedItems = [];
  const downloadTasks = [];
  const downloadedUrls = new Map(); // url -> localPath (去重下载)

  for (const item of filteredItems) {
    const catConfig = TARGET_CATEGORIES[item.secondClass];
    categoryStats[item.secondClass]++;

    const oid = String(item.objectID);
    const langInfo = langDict[oid] || {};

    // 名称解析
    const nameTw = langInfo.name || item.objectName || `道具_${oid}`;
    const nameCn = toSimplifiedChinese(nameTw);

    // 描述解析
    const descTw = langInfo.desc || item.desc || '';
    const descCn = toSimplifiedChinese(descTw);

    // 占格与重量解析
    const width = Number(item.width) || 1;
    const length = Number(item.length) || 1;
    const gridSize = `${width}x${length}`;
    const totalGrid = width * length;
    const weightKg = item.weight ? parseFloat(item.weight) : 0;

    // 图片路径规划
    const remotePic = normalizePicUrl(item.pic);
    const remoteThumb = normalizePicUrl(item.prePic);

    // 文件名以 objectID 命名，保持规范且唯一
    const ext = path.extname(remotePic) || '.png';
    const fileName = `${item.objectID}${ext}`;
    const fileRelPath = `/assets/items/${catConfig.folder}/${fileName}`;
    const fileAbsPath = path.join(BASE_ASSETS_DIR, catConfig.folder, fileName);

    // 详情属性解析
    const detail = { ...item.propsDetail };
    if (detail.useMap) detail.useMap = toSimplifiedChinese(langInfo.map || detail.useMap);
    if (detail.usePlace) detail.usePlace = toSimplifiedChinese(langInfo.place || detail.usePlace);
    if (detail.repairArea) detail.repairArea = toSimplifiedChinese(langInfo.area || detail.repairArea);
    if (detail.replyEffect) detail.replyEffect = toSimplifiedChinese(langInfo.reply || detail.replyEffect);
    if (detail.repairEfficiency) detail.repairEfficiency = toSimplifiedChinese(langInfo.eff || detail.repairEfficiency);
    if (detail.propsSource) detail.propsSource = toSimplifiedChinese(langInfo.source || detail.propsSource);
    if (detail.type) detail.type = toSimplifiedChinese(langInfo.type || detail.type);

    // 稀有度与品级等级解析 (6级=红, 5级=橙, 4级=紫, 3级=蓝, 2级=绿, 1级=白)
    const grade = Number(item.grade) || 1;
    const rarityInfo = RARITY_MAP[grade] || RARITY_MAP[1];

    parsedItems.push({
      id: item.objectID,
      name: nameCn,
      category: item.secondClass,
      categoryName: catConfig.name,
      // 等级标识与稀有度体系
      level: rarityInfo.level,
      colorHex: rarityInfo.colorHex,
      bgColorHex: rarityInfo.bgColorHex,
      levelIconClass: rarityInfo.iconClass,
      width: width,
      length: length,
      gridSize: gridSize,
      totalGrid: totalGrid,
      weight: weightKg,
      desc: descCn,
      remotePicUrl: remotePic,
      remoteThumbUrl: remoteThumb,
      localPicPath: fileRelPath,
      fileName: fileName,
      propsDetail: detail
    });

    // 准备下载任务
    if (remotePic) {
      if (!fs.existsSync(fileAbsPath) || fs.statSync(fileAbsPath).size === 0) {
        downloadTasks.push(async () => {
          const res = await fetch(remotePic, {
            headers: { 'user-agent': 'Mozilla/5.0' }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${remotePic}`);
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(fileAbsPath, buf);
        });
      }
    }
  }

  console.log(`\n4. 开始下载道具高清图片 (待下载任务数: ${downloadTasks.length})...`);
  if (downloadTasks.length > 0) {
    const { successCount, failCount } = await downloadPool(downloadTasks, 15);
    console.log(`- 下载完毕！成功: ${successCount}, 失败: ${failCount}`);
  } else {
    console.log('- 所有图片已在本地缓存，无需重复下载。');
  }

  // 5. 按照类别与稀有度整理索引
  const categoriesMap = {};
  for (const [key, conf] of Object.entries(TARGET_CATEGORIES)) {
    const list = parsedItems.filter(i => i.category === key);
    categoriesMap[key] = {
      key: conf.key,
      name: conf.name,
      folder: conf.folder,
      count: list.length,
      list: list
    };
  }

  // 等级与稀有度分布统计
  const rarityStats = {
    '红': 0,
    '橙': 0,
    '紫': 0,
    '蓝': 0,
    '绿': 0,
    '白': 0
  };
  const levelStats = {
    '6级 (红)': 0,
    '5级 (橙)': 0,
    '4级 (紫)': 0,
    '3级 (蓝)': 0,
    '2级 (绿)': 0,
    '1级 (白)': 0
  };

  parsedItems.forEach(i => {
    if (rarityStats[i.color] !== undefined) {
      rarityStats[i.color]++;
    }
    const lvlKey = `${i.level}级 (${i.color})`;
    if (levelStats[lvlKey] !== undefined) {
      levelStats[lvlKey]++;
    }
  });

  // 6. 生成并导出稀有度雪碧图与小程序样式
  const levelsDir = path.resolve(__dirname, '../miniprogram/assets/icons/levels');
  if (!fs.existsSync(levelsDir)) fs.mkdirSync(levelsDir, { recursive: true });

  const spriteSource = path.resolve(__dirname, 'level_icons_sprite.png');
  const spriteDest = path.join(levelsDir, 'level_sprite.png');
  if (fs.existsSync(spriteSource)) {
    fs.copyFileSync(spriteSource, spriteDest);
  }

  // 生成微信小程序适用的稀有度图标 WXSS 样式
  const levelWxssContent = `/* 官方等级与稀有度图标样式 (红/橙/紫/蓝/绿/白) */
.item-level-icon {
  display: inline-block;
  vertical-align: middle;
  background-repeat: no-repeat;
}

/* 6级 - 红色 (Red) */
.img_levelicon_06 {
  width: 48rpx;
  height: 47rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -10rpx -10rpx;
  background-size: 173rpx 131rpx;
}

/* 5级 - 橙色 (Orange/Gold) */
.img_levelicon_05 {
  width: 44rpx;
  height: 44rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -10rpx -77rpx;
  background-size: 173rpx 131rpx;
}

/* 4级 - 紫色 (Purple) */
.img_levelicon_04 {
  width: 44rpx;
  height: 44rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -78rpx -10rpx;
  background-size: 173rpx 131rpx;
}

/* 3级 - 蓝色 (Blue) */
.img_levelicon_03 {
  width: 44rpx;
  height: 33rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -74rpx -77rpx;
  background-size: 173rpx 131rpx;
}

/* 2级 - 绿色 (Green) */
.img_levelicon_02 {
  width: 21rpx;
  height: 42rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -142rpx -10rpx;
  background-size: 173rpx 131rpx;
}

/* 1级 - 白色 (White) */
.img_levelicon_01 {
  width: 21rpx;
  height: 21rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -142rpx -72rpx;
  background-size: 173rpx 131rpx;
}
`;
  fs.writeFileSync(path.join(levelsDir, 'level_icons.wxss'), levelWxssContent, 'utf8');

  // 精简后的稀有度定义（剔除 color, rarity, iconClass）
  const cleanRarityDefinitions = {};
  for (const [k, v] of Object.entries(RARITY_MAP)) {
    cleanRarityDefinitions[k] = {
      level: v.level,
      colorHex: v.colorHex,
      bgColorHex: v.bgColorHex
    };
  }

  const manifestData = {
    generatedAt: new Date().toISOString(),
    sourceWiki: 'https://www.playdeltaforce.com/act/officialwiki/zh-tw/#/item/consume',
    totalItems: parsedItems.length,
    categoryCounts: categoryStats,
    rarityDefinitions: cleanRarityDefinitions,
    categories: categoriesMap
  };

  // 写入 manifest.json
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`\n5. 元数据清单已生成: ${MANIFEST_PATH}`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n=== 爬取完成！耗时: ${duration}s ===`);
  console.log(`- 收藏品 (collection): ${categoryStats.collection} 件`);
  console.log(`- 消耗品 (consume): ${categoryStats.consume} 件`);
  console.log(`- 门卡 (key): ${categoryStats.key} 件`);
  console.log(`- 等级与稀有度分布:`);
  for (const [lvl, cnt] of Object.entries(levelStats)) {
    console.log(`  * ${lvl}: ${cnt} 件`);
  }
  console.log(`- 合计: ${parsedItems.length} 件`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
