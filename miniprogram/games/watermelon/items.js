/**
 * 三角洲摸金版《合成大西瓜》(合成非洲之心) - 11 级阶梯道具定义
 * 严格 1:1 对标斗鱼 Cocos 官方 STAGE_LAYOUT (702:976) 与 oe 基准物理半径
 * 严格基于 miniprogram/assets/items/item_manifest.json 官方国内已备案 CDN 资产
 */

// 斗鱼官方基准舞台宽度 (STAGE_LAYOUT.ratioWidth: 702)
const BASE_STAGE_WIDTH = 702;

const WATERMELON_ITEMS = [
  {
    level: 1,
    id: 15010010004,
    name: '含氟牙膏',
    tierName: '1级 (白·小)',
    baseRadius: 26, // 1:1 对标斗鱼 Lv.1 Blueberry (26px / 702px = 7.4%)
    radius: 26,
    score: 2,
    price: 2264,
    colorHex: '#9CA3AF',
    bgColorHex: '#1e2222',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15010010004.png'
  },
  {
    level: 2,
    id: 15020010001,
    name: '精密工具组',
    tierName: '1级 (白·大)',
    baseRadius: 41, // 1:1 对标斗鱼 Lv.2 Orange (41px / 702px = 11.7%)
    radius: 41,
    score: 4,
    price: 3120,
    colorHex: '#9CA3AF',
    bgColorHex: '#1e2222',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010001.png'
  },
  {
    level: 3,
    id: 15010010015,
    name: '迷你氢电池',
    tierName: '2级 (绿·小)',
    baseRadius: 54, // 1:1 对标斗鱼 Lv.3 Lime (54px / 702px = 15.4%)
    radius: 54,
    score: 8,
    price: 2562,
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15010010015.png'
  },
  {
    level: 4,
    id: 15020010005,
    name: '螺丝刀',
    tierName: '2级 (绿·大)',
    baseRadius: 60, // 1:1 对标斗鱼 Lv.4 DragonFruit (60px / 702px = 17.1%)
    radius: 60,
    score: 16,
    price: 4890,
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010005.png'
  },
  {
    level: 5,
    id: 15020010016,
    name: '一桶油漆',
    tierName: '3级 (蓝·小)',
    baseRadius: 76, // 1:1 对标斗鱼 Lv.5 Kiwi (76px / 702px = 21.7%)
    radius: 76,
    score: 32,
    price: 25400,
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010016.png'
  },
  {
    level: 6,
    id: 15020010015,
    name: '一包水泥',
    tierName: '3级 (蓝·大)',
    baseRadius: 92, // 1:1 对标斗鱼 Lv.6 Apple (92px / 702px = 26.2%)
    radius: 92,
    score: 64,
    price: 51007,
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010015.png'
  },
  {
    level: 7,
    id: 15020010024,
    name: '高出力粉碎钳',
    tierName: '4级 (紫)',
    baseRadius: 97, // 1:1 对标斗鱼 Lv.7 Peach (97px / 702px = 27.6%)
    radius: 97,
    score: 128,
    price: 135800,
    colorHex: '#9333EA',
    bgColorHex: '#1e1c2c',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010024.png'
  },
  {
    level: 8,
    id: 15030040001,
    name: '镜头',
    tierName: '5级 (金)',
    baseRadius: 129, // 1:1 对标斗鱼 Lv.8 Pineapple (129px / 702px = 36.8%)
    radius: 129,
    score: 256,
    price: 321241,
    colorHex: '#F59E0B',
    bgColorHex: '#37281b',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15030040001.png'
  },
  {
    level: 9,
    id: 15020010031,
    name: '强化碳纤维板',
    tierName: '6级 (红·小金)',
    baseRadius: 154, // 1:1 对标斗鱼 Lv.9 Coconut (154px / 702px = 43.9%)
    radius: 154,
    score: 512,
    price: 885000,
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010031.png'
  },
  {
    level: 10,
    id: 15010050001,
    name: '黄金瞪羚',
    tierName: '6级 (红·大金)',
    baseRadius: 164, // 1:1 对标斗鱼 Lv.10 HalfWatermelon (164px / 702px = 46.7%)
    radius: 164,
    score: 1024,
    price: 1850000,
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15010050001.png'
  },
  {
    level: 11,
    id: 15080050006,
    name: '非洲之心',
    tierName: '终极大金·非洲之心',
    baseRadius: 170, // 1:1 对标斗鱼 Lv.11 Watermelon (170px / 702px = 48.4%)
    radius: 170,
    score: 2048,
    price: 12484244,
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png',
    isUltimate: true
  }
];

// 计算初始默认质量 (正比于面积平方比)
const baseR1 = WATERMELON_ITEMS[0].baseRadius;
WATERMELON_ITEMS.forEach(it => {
  it.mass = Math.round(((it.baseRadius * it.baseRadius) / (baseR1 * baseR1)) * 10) / 10;
});

// 按 level 建立索引缓存
const ITEM_MAP = {};
WATERMELON_ITEMS.forEach(item => {
  ITEM_MAP[item.level] = item;
});

/**
 * 1:1 对标斗鱼 Cocos getStageFruitRadius：按当前屏幕宽度等比换算物理半径
 * @param {number} level 道具等级 (1~11)
 * @param {number|null} stageWidth 当前舞台实际物理像素宽度 (若为空默认按 702)
 */
function getStageFruitRadius(level, stageWidth = null) {
  const item = ITEM_MAP[level] || ITEM_MAP[1];
  const width = (stageWidth && stageWidth > 0) ? stageWidth : BASE_STAGE_WIDTH;
  const stageScale = width / BASE_STAGE_WIDTH;
  return Math.max(1, Math.round(item.baseRadius * stageScale));
}

/**
 * 获取道具数据 (支持基于舞台宽度动态自适应半径)
 * @param {number} level 道具等级 (1~11)
 * @param {number|null} stageWidth 当前舞台实际宽度
 */
function getItemByLevel(level, stageWidth = null) {
  const raw = ITEM_MAP[level];
  if (!raw) return null;

  if (stageWidth && stageWidth > 0) {
    const radius = getStageFruitRadius(level, stageWidth);
    return {
      ...raw,
      radius
    };
  }

  return raw;
}

module.exports = {
  BASE_STAGE_WIDTH,
  WATERMELON_ITEMS,
  ITEM_MAP,
  MAX_LEVEL: 11,
  getStageFruitRadius,
  getItemByLevel
};
