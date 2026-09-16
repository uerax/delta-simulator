/**
 * 三角洲摸金版《合成大西瓜》(合成非洲之心) - 11 级阶梯道具定义
 * 严格基于 miniprogram/assets/items/item_manifest.json 官方国内已备案 CDN 资产
 */

const WATERMELON_ITEMS = [
  {
    level: 1,
    id: 15010010004,
    name: '含氟牙膏',
    tierName: '1级 (白·小)',
    radius: 18,
    mass: 1.0,
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
    radius: 24,
    mass: 1.4,
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
    radius: 30,
    mass: 2.0,
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
    radius: 37,
    mass: 2.8,
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
    radius: 45,
    mass: 3.8,
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
    radius: 54,
    mass: 5.0,
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
    radius: 64,
    mass: 6.5,
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
    radius: 75,
    mass: 8.2,
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
    radius: 88,
    mass: 10.2,
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
    radius: 102,
    mass: 12.5,
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
    radius: 120,
    mass: 15.0,
    score: 2048,
    price: 12484244,
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png',
    isUltimate: true
  }
];

// 按 level 建立索引缓存
const ITEM_MAP = {};
WATERMELON_ITEMS.forEach(item => {
  ITEM_MAP[item.level] = item;
});

module.exports = {
  WATERMELON_ITEMS,
  ITEM_MAP,
  MAX_LEVEL: 11,
  getItemByLevel(level) {
    return ITEM_MAP[level] || null;
  }
};
