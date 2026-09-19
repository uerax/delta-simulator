/**
 * 三角洲摸金版《合成大西瓜》(合成非洲之心) - 11 级阶梯道具定义
 * 严格 1:1 对标斗鱼 Cocos 官方 STAGE_LAYOUT (702:976) 与 oe 基准物理半径
 * 严格基于 miniprogram/assets/items/item_manifest.js 官方国内已备案 CDN 资产
 * 支持基于 grade 动态从 ItemManager 的 1~6 级道具池随机抽取本局道具组合
 */

const ItemManager = require('../../utils/itemManager');

// 斗鱼官方基准舞台宽度 (STAGE_LAYOUT.ratioWidth: 702)
const BASE_STAGE_WIDTH = 702;

// 终极大金非洲之心专属标识 (Lv.10 等低阶随机抽取时绝对排除)
const HEART_OF_AFRICA_ID = 15080050006;
const HEART_OF_AFRICA_NAME = '非洲之心';

const WATERMELON_ITEMS = [
  {
    level: 1,
    grade: 1,
    id: 15010010004,
    name: '含氟牙膏',
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
    grade: 2,
    id: 15020010001,
    name: '精密工具组',
    baseRadius: 41, // 1:1 对标斗鱼 Lv.2 Orange (41px / 702px = 11.7%)
    radius: 41,
    score: 4,
    price: 3120,
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010001.png'
  },
  {
    level: 3,
    grade: 2,
    id: 15010010015,
    name: '迷你氢电池',
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
    grade: 3,
    id: 15020010005,
    name: '螺丝刀',
    baseRadius: 60, // 1:1 对标斗鱼 Lv.4 DragonFruit (60px / 702px = 17.1%)
    radius: 60,
    score: 16,
    price: 4890,
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010005.png'
  },
  {
    level: 5,
    grade: 3,
    id: 15020010016,
    name: '一桶油漆',
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
    grade: 4,
    id: 15020010015,
    name: '一包水泥',
    baseRadius: 92, // 1:1 对标斗鱼 Lv.6 Apple (92px / 702px = 26.2%)
    radius: 92,
    score: 64,
    price: 51007,
    colorHex: '#9333EA',
    bgColorHex: '#1e1c2c',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010015.png'
  },
  {
    level: 7,
    grade: 4,
    id: 15020010024,
    name: '高出力粉碎钳',
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
    grade: 5,
    id: 15030040001,
    name: '镜头',
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
    grade: 5,
    id: 15020010031,
    name: '强化碳纤维板',
    baseRadius: 154, // 1:1 对标斗鱼 Lv.9 Coconut (154px / 702px = 43.9%)
    radius: 154,
    score: 512,
    price: 885000,
    colorHex: '#F59E0B',
    bgColorHex: '#37281b',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15020010031.png'
  },
  {
    level: 10,
    grade: 6,
    id: 15010050001,
    name: '黄金瞪羚',
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
    grade: 6,
    id: 15080050006,
    name: '非洲之心',
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

/**
 * 从 ItemManager 随机刷新本局道具组合
 * 严格按照 grade 映射与价格半区分档抽取对应等级道具，本局内 ID 互不重复，Lv.11 固定为非洲之心
 * 映射与身价分档规则 (方案 A: 2~5 级道具半区分档，彻底解决小球比大球贵的身价倒挂):
 * 1  -> grade 1 (全池白品)
 * 2  -> grade 2 (平价绿品: slice mid~end)
 * 3  -> grade 2 (高价绿品: slice 0~mid)
 * 4  -> grade 3 (平价蓝品: slice mid~end)
 * 5  -> grade 3 (高价蓝品: slice 0~mid)
 * 6  -> grade 4 (平价紫品: slice mid~end)
 * 7  -> grade 4 (高价紫品: slice 0~mid)
 * 8  -> grade 5 (平价橙品: slice mid~end)
 * 9  -> grade 5 (高价橙品: slice 0~mid)
 * 10 -> grade 6 (全池红品，排除非洲之心)
 * 11 -> 非洲之心
 * @returns {Array<Object>} 刷新后的 WATERMELON_ITEMS
 */
function refreshWatermelonItems() {
  try {
    if (typeof ItemManager.init === 'function') {
      ItemManager.init();
    }
    // 初始排除非洲之心（专属留给 Lv.11），并用于记录本局已抽中道具以全局去重
    const usedIds = new Set([HEART_OF_AFRICA_NAME, HEART_OF_AFRICA_ID, String(HEART_OF_AFRICA_ID)]);

    // 2~5 级对应大西瓜 level 2~9 的双阶半区分档配置表 (方案 A)
    const TIER_MAP = {
      2: 'low',
      3: 'high',
      4: 'low',
      5: 'high',
      6: 'low',
      7: 'high',
      8: 'low',
      9: 'high'
    };

    for (let i = 0; i < WATERMELON_ITEMS.length; i++) {
      const it = WATERMELON_ITEMS[i];
      const tier = TIER_MAP[it.level] || 'all';

      const picked = (it.level === 11)
        ? (ItemManager.getByName(HEART_OF_AFRICA_NAME) || ItemManager.getById(HEART_OF_AFRICA_ID))
        : ItemManager.getRandomByLevel(it.grade, usedIds, tier);

      if (picked) {
        usedIds.add(picked.id);
        it.id = picked.id;
        it.name = picked.name;
        it.price = picked.price;
        it.priceFormatted = picked.priceFormatted;
        it.iconUrl = picked.pic;
        if (picked.theme) {
          it.colorHex = picked.theme.colorHex;
          it.bgColorHex = picked.theme.bgColor;
        }
      }
      ITEM_MAP[it.level] = it;
    }
  } catch (err) {
    console.warn('[items.js] refreshWatermelonItems safe caught:', err);
  }

  return WATERMELON_ITEMS;
}

// 模块初次加载时执行一次随机初始化
refreshWatermelonItems();

module.exports = {
  BASE_STAGE_WIDTH,
  WATERMELON_ITEMS,
  ITEM_MAP,
  MAX_LEVEL: 11,
  getStageFruitRadius,
  getItemByLevel,
  refreshWatermelonItems
};
