/**
 * 今日鼠鼠运势 - 确定性伪随机算法与六维战术流水线 (FortuneAlgorithm)
 *
 * 核心架构:
 *  1. MurmurHash3 (32-bit x86): 字符串雪崩散列，输出均匀 32-bit uint 种子
 *  2. Mulberry32 PRNG: 确定性高品质伪随机数生成器 (周期 2^32)
 *  3. 防御性强自然保序 (Deterministic Sort Defense):
 *     - 地图按 key 字母序升序强排序
 *     - 道具按 id 数值升序强排序
 *     - 容器按 key 字母序升序强排序
 *     - 地标按拼音/字符串升序强排序
 *     彻底消除任何环境和平台下的排序抖动风险
 *  4. 六维战术全景流水线:
 *     - 维度一: 战况吉凶与黑话等级 (免费正态加权 / 付费高阶保底加权)
 *     - 维度二: 本命信物道具 (对应品阶内安全抽取)
 *     - 维度三: 大红吉位地图与核心地标 (零号大坝·行政辖区、长弓溪谷·钻石皇后酒店等)
 *     - 维度四: 暴富容器 (含常规高价值容器、辐射特种设施容器、人机包等)
 *     - 维度五: 战术老黄历与锦囊建议 (动态占位符安全插值)
 *     - 维度六: 运势评分与安全撤离指数
 */

const mapManager = require('../../utils/mapManager');
const itemManager = require('../../utils/itemManager');
const {
  LEVEL_COPYWRITING,
  FORTUNE_ORACLES,
  FREE_LUCKY_LEVEL_WEIGHTS,
  PAID_LUCKY_LEVEL_WEIGHTS,
  MAP_LANDMARKS,
  CONTAINER_DEFINITIONS
} = require('./fortuneConfig');

/**
 * MurmurHash3 (32-bit x86 variant) 散列算法
 * @param {string} str 输入字符串
 * @param {number} [seed=0] 初始种子
 * @returns {number} 32位无符号整数
 */
function murmurHash3(str, seed = 0) {
  let h1 = seed >>> 0;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  for (let i = 0; i < str.length; i++) {
    let k1 = str.charCodeAt(i);
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  h1 ^= str.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * Mulberry32 伪随机数发生器
 */
class Mulberry32PRNG {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  /**
   * 生成 [0, 1) 浮点伪随机数
   * @returns {number}
   */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * 生成 [min, max] 闭区间随机整数
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextInt(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * 从数组中均匀随机选取一个元素
   * @param {Array} array
   * @returns {*}
   */
  pick(array) {
    if (!array || array.length === 0) return null;
    const index = Math.floor(this.next() * array.length);
    return array[index];
  }

  /**
   * 按照权重配置抽取元素
   * @param {Array<{ item: any, weight: number }>} weightedItems
   * @returns {*}
   */
  pickWeighted(weightedItems) {
    if (!weightedItems || weightedItems.length === 0) return null;
    const totalWeight = weightedItems.reduce((sum, el) => sum + el.weight, 0);
    let rand = this.next() * totalWeight;

    for (const entry of weightedItems) {
      if (rand < entry.weight) {
        return entry.item;
      }
      rand -= entry.weight;
    }
    return weightedItems[weightedItems.length - 1].item;
  }
}

/**
 * 解析并抽取吉凶箴言、老黄历宜忌与战术建议
 * @param {Mulberry32PRNG} prng 伪随机发生器
 * @param {number} luckyLevel 选中的道具等级 1~6
 * @param {Object} luckyMap 选中的地图
 * @param {string} luckySpot 选中的地标
 * @param {Object} luckyContainer 选中的暴富容器
 * @param {Object} luckyItem 选中的道具
 * @returns {Object} 包含吉凶、黑话、老黄历宜忌与建议的完整对象
 */
function resolveFortuneWisdom(prng, luckyLevel, luckyMap, luckySpot, luckyContainer, luckyItem) {
  const levelConfig = LEVEL_COPYWRITING[luckyLevel] || FORTUNE_ORACLES[luckyLevel] || LEVEL_COPYWRITING[4];

  // 1. 简短评价与副标题
  let sign = levelConfig.sign || '吉';
  if (Array.isArray(sign)) {
    sign = prng.pick(sign);
  }

  let subTitle = '';
  if (Array.isArray(levelConfig.subTitles) && levelConfig.subTitles.length > 0) {
    subTitle = prng.pick(levelConfig.subTitles);
  }

  // 2. 占位符字典准备
  const mapName = (luckyMap && luckyMap.name) ? luckyMap.name : '战区';
  const spotName = luckySpot || '核心战区';
  const containerName = (luckyContainer && luckyContainer.name) ? luckyContainer.name : '安全箱';
  const itemName = (luckyItem && luckyItem.name) ? luckyItem.name : '未知物资';
  const levelName = levelConfig.levelName || '战利品';
  const priceFormatted = (luckyItem && luckyItem.priceFormatted) ? luckyItem.priceFormatted : '0';

  const replacePlaceholders = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\{map\}/g, mapName)
      .replace(/\{spot\}/g, spotName)
      .replace(/\{container\}/g, containerName)
      .replace(/\{item\}/g, itemName)
      .replace(/\{levelName\}/g, levelName)
      .replace(/\{price\}/g, priceFormatted);
  };

  // 3. 抽取战术建议 (动态占位符插值)
  const advicePool = Array.isArray(levelConfig.advices) ? levelConfig.advices : [];
  const rawAdvice = advicePool.length > 0
    ? prng.pick(advicePool)
    : '战场局势瞬息万变，在【{map}·{spot}】搜刮务必见好就收，活着安全撤离才是一切。';
  const formattedAdvice = replacePlaceholders(rawAdvice);

  // 4. 抽取老黄历【宜】与【忌】
  const yiPool = Array.isArray(levelConfig.yi) ? levelConfig.yi : ['谨慎搜刮', '结伴同行'];
  const jiPool = Array.isArray(levelConfig.ji) ? levelConfig.ji : ['盲目硬冲', '开阔地奔跑'];

  const yi = yiPool.map(replacePlaceholders);
  const ji = jiPool.map(replacePlaceholders);

  return {
    level: luckyLevel,
    levelName: levelConfig.levelName || '战利品',
    colorHex: levelConfig.colorHex,
    bgColorHex: levelConfig.bgColorHex,
    sign,
    subTitle,
    advice: formattedAdvice,
    almanac: {
      yi,
      ji
    }
  };
}

/**
 * 每日运势核心计算函数 (对外主入口)
 * @param {Object} params
 * @param {string} params.dateStr 格式 YYYY-MM-DD (例如 '2026-09-18')
 * @param {string} params.userId 用户唯一标识 (如 'usr_xxxxx' 或 openid)
 * @param {number} [params.rerollCount=0] 付费改运/重掷计数 (默认0，每次付费递增打破旧随机)
 * @param {boolean} [params.isPaid=false] 是否启用付费强运保底 (true 时保证 3 级小蓝以上并大幅提升 5~6 级)
 * @returns {Object} 包含地图、地标、容器、等级、黑话、道具、签文、老黄历、分数的完整运势报表
 */
function calculateDailyFortune({ dateStr, userId, rerollCount = 0, isPaid = false }) {
  if (!dateStr || !userId) {
    throw new Error('[FortuneAlgorithm] 必须提供有效的 dateStr 与 userId');
  }

  // 1. 构造具有唯一身份与状态的 Seed 原始字符串并生成确定性种子
  const seedKey = `${dateStr}#${userId}#reroll:${rerollCount}#paid:${isPaid ? 1 : 0}`;
  const seed = murmurHash3(seedKey);
  const prng = new Mulberry32PRNG(seed);

  // 2. 维度一：吉凶定级与黑话抽取 (免费正态加权 / 付费强运加权)
  let luckyLevel;
  if (!isPaid) {
    luckyLevel = prng.pickWeighted(FREE_LUCKY_LEVEL_WEIGHTS);
  } else {
    luckyLevel = prng.pickWeighted(PAID_LUCKY_LEVEL_WEIGHTS);
  }
  // 保底容错
  if (!luckyLevel || luckyLevel < 1 || luckyLevel > 6) {
    luckyLevel = 4;
  }

  // 3. 维度二：大红吉位地图抽取 (按 key 字母序保序强排序)
  const allMaps = mapManager.getAllMaps();
  const safeMaps = allMaps
    .slice()
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''));
  const rawLuckyMap = prng.pick(safeMaps) || safeMaps[0];

  // 3.1 核心出金地标抽取 (从 MAP_LANDMARKS 字典中保序抽取，官方全地图百分比坐标与 8x8 切片矩阵元数据)
  const landmarkConfig = MAP_LANDMARKS[rawLuckyMap.key] || { landmarks: [{ name: '核心战区', coord: { x: 50, y: 50 }, tile: { col: 4, row: 4 } }] };
  const safeLandmarks = landmarkConfig.landmarks.slice().sort((a, b) => {
    const nameA = typeof a === 'string' ? a : a.name;
    const nameB = typeof b === 'string' ? b : b.name;
    return nameA.localeCompare(nameB);
  });
  const rawSpot = prng.pick(safeLandmarks) || safeLandmarks[0];
  const luckySpotName = typeof rawSpot === 'string' ? rawSpot : rawSpot.name;
  const spotCoord = (rawSpot && rawSpot.coord) ? rawSpot.coord : { x: 50, y: 50 };
  const centerTile = (rawSpot && rawSpot.tile)
    ? rawSpot.tile
    : { col: Math.min(7, Math.max(0, Math.floor(spotCoord.x / 12.5))), row: Math.min(7, Math.max(0, Math.floor(spotCoord.y / 12.5))) };

  const mapLayer = rawLuckyMap.layer || `map_${rawLuckyMap.key}`;
  const cdnTileBase = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${mapLayer}/`;
  const tileUrlTemplate = `${cdnTileBase}3_{col}_{row}.jpg`;

  const luckyMap = {
    key: rawLuckyMap.key,
    name: rawLuckyMap.name,
    layer: mapLayer,
    desc: rawLuckyMap.desc,
    spot: luckySpotName,
    spotCoord: spotCoord,
    centerTile: centerTile,
    tileUrlTemplate: tileUrlTemplate,
    tileUrl: `${cdnTileBase}3_${centerTile.col}_${centerTile.row}.jpg`,
    previewTileUrl: rawLuckyMap.previewTileUrl
  };

  const luckySpot = luckySpotName;

  // 4. 维度三：暴富容器抽取 (按 key 字母序保序强排序，含常规与辐射容器)
  const safeContainers = CONTAINER_DEFINITIONS
    .slice()
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''));
  const luckyContainer = prng.pick(safeContainers) || safeContainers[0];

  // 5. 维度四：具体道具抽取 (按 id 数字升序强保序，消除同价格排序抖动)
  const rawItems = (typeof itemManager.getLevelList === 'function')
    ? itemManager.getLevelList(luckyLevel)
    : (itemManager.getItemsByLevel ? itemManager.getItemsByLevel(luckyLevel) : []);
  const safeItems = rawItems
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
  const luckyItem = prng.pick(safeItems) || safeItems[0] || {
    id: 0,
    name: '战术补给箱',
    price: 0,
    priceFormatted: '0',
    length: 1,
    width: 1
  };

  // 6. 维度五：吉凶评语、老黄历宜忌与战术建议抽取 (动态占位符安全替换)
  const fortuneWisdom = resolveFortuneWisdom(prng, luckyLevel, luckyMap, luckySpot, luckyContainer, luckyItem);

  // 7. 维度六：运势评分与安全撤离指数
  let fortuneScore;
  let extractionRateNum;

  if (luckyLevel === 6) {
    fortuneScore = prng.nextInt(95, 100);
    extractionRateNum = 95.0 + prng.next() * 4.9; // 95.0% ~ 99.9%
  } else if (luckyLevel === 5) {
    fortuneScore = prng.nextInt(85, 94);
    extractionRateNum = 85.0 + prng.next() * 9.9; // 85.0% ~ 94.9%
  } else if (luckyLevel === 4) {
    fortuneScore = prng.nextInt(75, 84);
    extractionRateNum = 75.0 + prng.next() * 9.9; // 75.0% ~ 84.9%
  } else if (luckyLevel === 3) {
    fortuneScore = prng.nextInt(60, 74);
    extractionRateNum = 60.0 + prng.next() * 14.9; // 60.0% ~ 74.9%
  } else if (luckyLevel === 2) {
    fortuneScore = prng.nextInt(45, 59);
    extractionRateNum = 45.0 + prng.next() * 14.9; // 45.0% ~ 59.9%
  } else {
    // 1级 答辩
    fortuneScore = prng.nextInt(20, 44);
    extractionRateNum = 20.0 + prng.next() * 24.9; // 20.0% ~ 44.9%
  }

  if (isPaid && fortuneScore < 80) {
    fortuneScore = prng.nextInt(85, 100);
    extractionRateNum = Math.max(extractionRateNum, 85.0 + prng.next() * 14.9);
  }

  const extractionRate = `${extractionRateNum.toFixed(1)}%`;

  return {
    dateStr,
    userId,
    rerollCount,
    isPaid,
    seedKey,
    seed,
    fortuneScore,
    extractionRate,
    luckyLevel,
    levelName: fortuneWisdom.levelName,
    colorHex: fortuneWisdom.colorHex,
    bgColorHex: fortuneWisdom.bgColorHex,
    luckyMap,
    luckySpot,
    luckyContainer,
    luckyItem,
    fortune: fortuneWisdom,
    almanac: fortuneWisdom.almanac
  };
}

module.exports = {
  murmurHash3,
  Mulberry32PRNG,
  resolveFortuneWisdom,
  calculateDailyFortune
};
