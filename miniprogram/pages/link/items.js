/**
 * miniprogram/pages/link/items.js
 * 鼠鼠连连看 - 局内物资管理器
 * 负责：
 *  1. 房卡/扑克牌精准过滤与单等级独占回填 (每个等级至多1张卡片，其余全为实体装备大件)
 *  2. 根据关卡等级动态计算道具种类数与棋盘容量 (36/48/60/72 格，以60格主力为主)
 *  3. 生成严格成对的方块数据元，支持图片等比缩放与对应等级品质底托渲染
 */

let itemManager = null;
try {
  itemManager = require('@/utils/itemManager');
} catch (e) {
  try {
    itemManager = require('../../utils/itemManager');
  } catch (err) {
    console.warn('LinkItems: itemManager fallback loading:', err);
  }
}

/**
 * 判定物品是否属于需要单独管制的同质化卡片/图纸
 * 严格按照定稿过滤：80件 1505 钥匙房卡、15张扑克牌、4张地图图纸
 * (具有自辨识度的军事通行证 15080050226、鎏金卡牌 15200000060 予以保留放行)
 */
function isKeycardOrPaper(item) {
  if (!item) return false;
  const idStr = String(item.id);
  const name = item.name || '';

  // 1. 全部 80 件 1505 官方钥匙房卡
  if (idStr.startsWith('1505')) return true;
  // 2. 扑克牌系列
  if (name.includes('扑克牌')) return true;
  // 3. 潮汐监狱地图图纸
  if (name.includes('地图-')) return true;

  return false;
}

/**
 * 获取分类好的物资池缓存
 */
let cachedPools = null;
function getCategorizedPools() {
  if (cachedPools) return cachedPools;

  const all = (itemManager && typeof itemManager.getAll === 'function')
    ? itemManager.getAll()
    : [];

  const solidByLevel = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const keycardByLevel = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  all.forEach(item => {
    // 过滤掉 0 元未挂牌道具
    if (!item || item.price <= 0) return;
    const lvl = item.level || 1;
    if (lvl < 1 || lvl > 6) return;

    if (isKeycardOrPaper(item)) {
      keycardByLevel[lvl].push(item);
    } else {
      solidByLevel[lvl].push(item);
    }
  });

  cachedPools = { solidByLevel, keycardByLevel };
  return cachedPools;
}

/**
 * 根据关卡数获取推荐的棋盘规模与道具种类数
 * 遵循规划：
 *  Lv.1~Lv.2: 36格，6种物资 (每种6个)
 *  Lv.3~Lv.5: 48格，8种物资 (每种6个)
 *  Lv.6~Lv.20 (主力区间): 60格，10种物资 (每种6个)
 *  Lv.20+ (高难挑战): 72格，12种物资 (每种6个)
 *
 * @param {number} stage 关卡数 (从 1 开始)
 * @returns {{ tileCount: number, typeCount: number, rows: number, cols: number }}
 */
function getStageConfig(stage = 1) {
  const currentStage = Math.max(1, Math.floor(stage));

  if (currentStage <= 2) {
    return { tileCount: 32, typeCount: 6, rows: 4, cols: 8 };
  }
  if (currentStage <= 5) {
    return { tileCount: 48, typeCount: 8, rows: 6, cols: 8 };
  }
  if (currentStage <= 20) {
    return { tileCount: 60, typeCount: 10, rows: 6, cols: 10 };
  }
  return { tileCount: 72, typeCount: 12, rows: 6, cols: 12 };
}

/**
 * 随机从数组中抽取一个不重复的项并从源数组移除 (Fisher-Yates 抽样辅助)
 */
function pullRandom(arr) {
  if (!arr || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr.splice(idx, 1)[0];
}

/**
 * 动态抽取本局物资种类
 * 核心规则：
 *  1. 保证红橙紫蓝绿白品质均有覆盖
 *  2. 每个品质等级至多只允许包含 1 张房卡/扑克牌，其余全部从实体大件池抽取
 *  3. 全场无任何同名重复道具
 *
 * @param {number} typeCount 需要抽取的物资种类总数 (如 6, 8, 10, 12)
 * @returns {Array<Object>} 抽取的道具列表
 */
function pickStageItems(typeCount = 10) {
  const { solidByLevel, keycardByLevel } = getCategorizedPools();

  // 浅拷贝各级候选池，以便无放回抽取
  const solidPool = {};
  const keycardPool = {};
  for (let l = 1; l <= 6; l++) {
    solidPool[l] = [...solidByLevel[l]];
    keycardPool[l] = [...keycardByLevel[l]];
  }

  const selectedItems = [];
  const keycardCountByLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  // 1. 保底：1~6 级每个品质先分 1 个名额
  const levelOrder = [6, 5, 4, 3, 2, 1]; // 优先高品质
  for (const lvl of levelOrder) {
    if (selectedItems.length >= typeCount) break;

    // 约 35% 概率优先尝试抽该等级的一张房卡 (仅限该等级卡片数为 0 时)
    let picked = null;
    const shouldTryKeycard = Math.random() < 0.35 && keycardPool[lvl].length > 0;

    if (shouldTryKeycard) {
      picked = pullRandom(keycardPool[lvl]);
      if (picked) {
        keycardCountByLevel[lvl] += 1;
      }
    }

    // 若未抽卡片或抽空，从实体大件抽取
    if (!picked) {
      picked = pullRandom(solidPool[lvl]);
    }

    if (picked) {
      selectedItems.push(picked);
    }
  }

  // 2. 剩余名额随机加权分配至各等级，严格执行单等级卡片数 <= 1 守卫
  while (selectedItems.length < typeCount) {
    // 随机选择一个还有可用物资的等级
    const availableLevels = levelOrder.filter(lvl => {
      const canKeycard = keycardCountByLevel[lvl] === 0 && keycardPool[lvl].length > 0;
      const canSolid = solidPool[lvl].length > 0;
      return canKeycard || canSolid;
    });

    if (availableLevels.length === 0) break; // 防御性跳出

    const lvl = availableLevels[Math.floor(Math.random() * availableLevels.length)];

    let picked = null;
    // 若该等级尚未抽取卡片，且卡片池有货，小概率抽取 1 张卡片
    if (keycardCountByLevel[lvl] === 0 && keycardPool[lvl].length > 0 && Math.random() < 0.25) {
      picked = pullRandom(keycardPool[lvl]);
      if (picked) {
        keycardCountByLevel[lvl] += 1;
      }
    }

    // 否则强制只从实体大件池抽取，杜绝同等级出现第 2 张卡片
    if (!picked && solidPool[lvl].length > 0) {
      picked = pullRandom(solidPool[lvl]);
    }

    if (picked) {
      selectedItems.push(picked);
    }
  }

  return selectedItems;
}

/**
 * 将抽取的物资按偶数配额生成棋盘方块源数据
 * 保证每种物资的数量均为偶数，相加严格等于 tileCount
 *
 * @param {Array<Object>} items 选中的物资列表
 * @param {number} tileCount 棋盘有效方块总数 (必为偶数)
 * @returns {Array<Object>} 方块数组
 */
function createBalancedTiles(items, tileCount) {
  if (!items || items.length === 0 || tileCount <= 0) return [];

  const types = items.length;
  // 计算基础每种几个 (必须为偶数)
  const basePairsPerType = Math.max(1, Math.floor(tileCount / (types * 2)));
  const counts = new Array(types).fill(basePairsPerType * 2);

  // 计算剩余待分配方块数 (必为偶数)
  let assignedTotal = counts.reduce((a, b) => a + b, 0);
  let remainder = tileCount - assignedTotal;

  // 每次以 +2 的步长分配给不同种类，直到填满
  let idx = 0;
  while (remainder >= 2) {
    counts[idx % types] += 2;
    remainder -= 2;
    idx++;
  }

  // 构造方块列表
  const tiles = [];
  items.forEach((item, tIdx) => {
    const qty = counts[tIdx];
    for (let i = 0; i < qty; i++) {
      tiles.push({
        id: item.id,
        name: item.name,
        level: item.level || 1,
        price: item.price || 0,
        priceFormatted: item.priceFormatted || String(item.price || 0),
        iconUrl: item.pic || item.iconUrl || '',
        colorHex: (item.theme && item.theme.colorHex) || '#9CA3AF',
        bgColor: (item.theme && item.theme.bgColor) || '#1e2222',
        isKeycard: isKeycardOrPaper(item)
      });
    }
  });

  return tiles;
}

module.exports = {
  isKeycardOrPaper,
  getCategorizedPools,
  getStageConfig,
  pickStageItems,
  createBalancedTiles
};
