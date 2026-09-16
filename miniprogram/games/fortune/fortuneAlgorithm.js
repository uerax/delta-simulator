/**
 * 今日鼠鼠运势 - 确定性伪随机算法与抽样流水线 (FortuneAlgorithm)
 *
 * 核心架构:
 *  1. MurmurHash3 (32-bit x86): 字符串雪崩散列，输出均匀 32-bit uint 种子
 *  2. Mulberry32 PRNG: 确定性高品质伪随机数生成器 (周期 2^32)
 *  3. 防御性强自然保序 (Deterministic Sort Defense):
 *     - 地图按 key 字母序升序强排序，杜绝 JSON 物理行顺序变更风险
 *     - 道具按 id 数值升序强排序，彻底消除同价道具在不同引擎环境下的排序抖动
 *  4. 四维流水线抽样:
 *     - 维度一: 幸运地图 (5~6张核心战术地图)
 *     - 维度二: 道具品质等级 (1~6级)
 *     - 维度三: 专属等级道具 (359+ 官方三角洲道具)
 *     - 维度四: 战况吉凶签文与 N 条战术建议 (动态占位符插值)
 */

const mapManager = require('../../utils/mapManager');
const itemManager = require('../../utils/itemManager');
const { FORTUNE_ORACLES, PAID_LUCKY_LEVEL_WEIGHTS } = require('./fortuneConfig');

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
 * 解析并抽取吉凶箴言与战术建议
 * @param {Mulberry32PRNG} prng 伪随机发生器
 * @param {number} luckyLevel 选中的道具等级
 * @param {Object} luckyMap 选中的地图
 * @param {Object} luckyItem 选中的道具
 * @returns {Object} { sign, subTitle, advice, colorHex }
 */
function resolveFortuneWisdom(prng, luckyLevel, luckyMap, luckyItem) {
  const levelConfig = FORTUNE_ORACLES[luckyLevel] || FORTUNE_ORACLES[3];

  // 1. 简短评价 (支持配置单字符串或候选数组)
  let sign = levelConfig.sign || '吉';
  if (Array.isArray(sign)) {
    sign = prng.pick(sign);
  }

  // 2. 抽取副标题/称号
  let subTitle = '';
  if (Array.isArray(levelConfig.subTitles) && levelConfig.subTitles.length > 0) {
    subTitle = prng.pick(levelConfig.subTitles);
  }

  // 3. 确定性步进抽取战术建议
  const advicePool = Array.isArray(levelConfig.advices) ? levelConfig.advices : [];
  let rawAdvice = advicePool.length > 0
    ? prng.pick(advicePool)
    : '战场局势瞬息万变，无论摸到什么，活着安全撤离才是一切。';

  // 4. 动态占位符安全插值
  const mapName = (luckyMap && luckyMap.name) ? luckyMap.name : '战区';
  const itemName = (luckyItem && luckyItem.name) ? luckyItem.name : '未知物资';

  const formattedAdvice = rawAdvice
    .replace(/\{map\}/g, mapName)
    .replace(/\{item\}/g, itemName);

  return {
    level: luckyLevel,
    colorHex: levelConfig.colorHex,
    sign,
    subTitle,
    advice: formattedAdvice
  };
}

/**
 * 每日运势核心计算函数 (对外主入口)
 * @param {Object} params
 * @param {string} params.dateStr 格式 YYYY-MM-DD (例如 '2026-09-17')
 * @param {string} params.userId 用户唯一标识 (如 'usr_xxxxx' 或 openid)
 * @param {number} [params.rerollCount=0] 付费改运/重掷计数 (默认0，每次付费递增打破旧随机)
 * @param {boolean} [params.isPaid=false] 是否启用付费强运保底 (true 时保证 3 级蓝以上并大幅提升 5~6 级)
 * @returns {Object} 包含地图、等级、道具、签文、分数的完整运势报表
 */
function calculateDailyFortune({ dateStr, userId, rerollCount = 0, isPaid = false }) {
  if (!dateStr || !userId) {
    throw new Error('[FortuneAlgorithm] 必须提供有效的 dateStr 与 userId');
  }

  // 1. 构造具有唯一身份与状态的 Seed 原始字符串
  const seedKey = `${dateStr}#${userId}#reroll:${rerollCount}#paid:${isPaid ? 1 : 0}`;
  const seed = murmurHash3(seedKey);
  const prng = new Mulberry32PRNG(seed);

  // 2. 维度一：战术地图抽取 (按 key 字母序保序，杜绝外部 JSON 乱序影响)
  const allMaps = mapManager.getAllMaps();
  const safeMaps = allMaps
    .slice()
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''));
  const luckyMap = prng.pick(safeMaps);

  // 3. 维度二：道具等级抽取 (1~6 级)
  let luckyLevel;
  if (!isPaid) {
    // 免费日常：1~6 级完全平铺等概率 (各 1/6)
    luckyLevel = prng.nextInt(1, 6);
  } else {
    // 付费强运：保底 3 级以上，红橙概率显著提升
    luckyLevel = prng.pickWeighted(PAID_LUCKY_LEVEL_WEIGHTS);
  }

  // 4. 维度三：具体道具抽取 (按 id 数字升序强保序，消除同价格排序抖动)
  const rawItems = (typeof itemManager.getLevelList === 'function')
    ? itemManager.getLevelList(luckyLevel)
    : (itemManager.getItemsByLevel ? itemManager.getItemsByLevel(luckyLevel) : []);
  const safeItems = rawItems
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
  const luckyItem = prng.pick(safeItems);

  // 5. 维度四：吉凶与 N 条战术建议抽取 (解耦文案池 + 动态占位符)
  const fortuneWisdom = resolveFortuneWisdom(prng, luckyLevel, luckyMap, luckyItem);

  // 6. 派生趣味字段：运势指数 (60~100 分，付费保底 80~100)
  const fortuneScore = isPaid ? prng.nextInt(80, 100) : prng.nextInt(60, 100);

  return {
    dateStr,
    userId,
    rerollCount,
    isPaid,
    seedKey,
    seed,
    fortuneScore,
    luckyMap,
    luckyLevel,
    luckyItem,
    fortune: fortuneWisdom
  };
}

module.exports = {
  murmurHash3,
  Mulberry32PRNG,
  resolveFortuneWisdom,
  calculateDailyFortune
};
