/**
 * 今日鼠鼠运势 - 规则配置与参数中心 (FortuneConfig)
 *
 * 核心架构:
 *  1. 引入独立文案字典 (fortuneCopywriting.js)，文案与规则代码彻底解耦
 *  2. 免费抽取权重池 (FREE_LUCKY_LEVEL_WEIGHTS):
 *     - 6级大红 8%, 5级小金 22%, 4级小紫 36%, 3级小蓝 20%, 2级小绿 10%, 1级答辩 4%
 *  3. 付费改运权重池 (PAID_LUCKY_LEVEL_WEIGHTS):
 *     - 6级大红 20%, 5级小金 35%, 4级小紫 30%, 3级小蓝 15%, 2级小绿 0%, 1级答辩 0%
 *  4. 地图地标字典 (MAP_LANDMARKS) 与战术容器池 (CONTAINER_DEFINITIONS)
 *  5. 兼容历史签文对象 (FORTUNE_ORACLES)
 */

const {
  LEVEL_COPYWRITING,
  MAP_LANDMARKS,
  CONTAINER_DEFINITIONS
} = require('./fortuneCopywriting');

/**
 * 免费日常抽取等级加权配置 (正态钟形分布)
 */
const FREE_LUCKY_LEVEL_WEIGHTS = Object.freeze([
  { item: 6, weight: 8 },   // 6级·大红 8%  (大吉)
  { item: 5, weight: 22 },  // 5级·小金 22% (吉)
  { item: 4, weight: 36 },  // 4级·小紫 36% (中平)
  { item: 3, weight: 20 },  // 3级·小蓝 20% (小凶)
  { item: 2, weight: 10 },  // 2级·小绿 10% (凶)
  { item: 1, weight: 4 }    // 1级·答辩 4%  (大凶)
]);

/**
 * 付费改运抽取等级加权配置 (保底无答辩、无小绿)
 */
const PAID_LUCKY_LEVEL_WEIGHTS = Object.freeze([
  { item: 6, weight: 20 },  // 6级·大红 20% (爆率提升 2.5 倍)
  { item: 5, weight: 35 },  // 5级·小金 35%
  { item: 4, weight: 30 },  // 4级·小紫 30%
  { item: 3, weight: 15 }   // 3级·小蓝 15%
]);

module.exports = {
  LEVEL_COPYWRITING,
  FORTUNE_ORACLES: LEVEL_COPYWRITING, // 向后完全兼容
  FREE_LUCKY_LEVEL_WEIGHTS,
  PAID_LUCKY_LEVEL_WEIGHTS,
  MAP_LANDMARKS,
  CONTAINER_DEFINITIONS
};
