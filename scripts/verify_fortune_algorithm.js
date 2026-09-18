/**
 * 每日运势确定性算法全场景校验脚本
 */

const Module = require('module');
const path = require('path');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(__dirname, '../miniprogram', request.slice(2));
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const { calculateDailyFortune, murmurHash3, Mulberry32PRNG } = require('../miniprogram/games/fortune/fortuneAlgorithm');
const mapManager = require('../miniprogram/utils/mapManager');
const itemManager = require('../miniprogram/utils/itemManager');

console.log('=== [1] 初始化底层资源管理器 ===');
mapManager.init();
itemManager.init();
console.log(`地图池数量: ${mapManager.getAllMaps().length}`);
console.log(`全量道具池数量: ${itemManager.getAllItems().length}`);

console.log('\n=== [2] 校验幂等性 (同一用户同一天连续调用 100 次) ===');
const testDate = '2026-09-17';
const testUser = 'usr_wesker_8888';

const baseline = calculateDailyFortune({ dateStr: testDate, userId: testUser, rerollCount: 0 });
console.log('基准首次运行结果:');
console.log(`  - 种子标识: ${baseline.seedKey}`);
console.log(`  - 幸运地图: ${baseline.luckyMap.name} (${baseline.luckyMap.key}) · 核心地标: ${baseline.luckyMap.spot}`);
console.log(`  - 暴富容器: ${baseline.luckyContainer.name} (${baseline.luckyContainer.key})`);
console.log(`  - 道具等级: ${baseline.luckyLevel}级 [${baseline.levelName}] (${baseline.luckyItem.theme ? baseline.luckyItem.theme.name : ''})`);
console.log(`  - 幸运道具: ${baseline.luckyItem.name} (价格: ¥${baseline.luckyItem.priceFormatted})`);
console.log(`  - 运势评分: ${baseline.fortuneScore}分 | 安全撤离率: ${baseline.extractionRate}`);
console.log(`  - 战况吉凶: ${baseline.fortune.sign} · ${baseline.fortune.subTitle}`);
console.log(`  - 战术建议: ${baseline.fortune.advice}`);
console.log(`  - 老黄历宜: ${baseline.almanac.yi.join(' / ')}`);
console.log(`  - 老黄历忌: ${baseline.almanac.ji.join(' / ')}`);

let isConsistent = true;
for (let i = 0; i < 100; i++) {
  const current = calculateDailyFortune({ dateStr: testDate, userId: testUser, rerollCount: 0 });
  if (
    current.seed !== baseline.seed ||
    current.luckyMap.key !== baseline.luckyMap.key ||
    current.luckyMap.spot !== baseline.luckyMap.spot ||
    current.luckyContainer.key !== baseline.luckyContainer.key ||
    current.luckyLevel !== baseline.luckyLevel ||
    current.levelName !== baseline.levelName ||
    current.luckyItem.id !== baseline.luckyItem.id ||
    current.fortune.sign !== baseline.fortune.sign ||
    current.fortune.advice !== baseline.fortune.advice ||
    current.fortuneScore !== baseline.fortuneScore ||
    current.extractionRate !== baseline.extractionRate
  ) {
    isConsistent = false;
    console.error(`第 ${i} 次调用出现不一致！`, current);
    break;
  }
}

if (isConsistent) {
  console.log('✅ 100 次请求幂等性验证 100% 通过！结果毫无偏差。');
} else {
  process.exit(1);
}

console.log('\n=== [3] 校验付费改运机制 (Reroll 递增打破旧随机) ===');
const rerolls = [];
for (let r = 0; r <= 3; r++) {
  const res = calculateDailyFortune({ dateStr: testDate, userId: testUser, rerollCount: r, isPaid: r > 0 });
  rerolls.push(res);
  console.log(`  [改运次数 ${r}${r > 0 ? ' (付费加权)' : ' (免费首次)'}]: 地图=${res.luckyMap.name}·${res.luckyMap.spot} | 等级=${res.luckyLevel}级[${res.levelName}] | 容器=${res.luckyContainer.name} | 道具=${res.luckyItem.name} | 评价=${res.fortune.sign}`);

  // 验证付费保底不含答辩与小绿
  if (r > 0 && res.luckyLevel < 3) {
    console.error(`❌ 付费改运未能保底3级以上！当前等级: ${res.luckyLevel}`);
    process.exit(1);
  }
}

// 验证改运后种子不同
const distinctSeeds = new Set(rerolls.map(r => r.seed));
if (distinctSeeds.size === rerolls.length) {
  console.log('✅ 付费改运各轮次种子 100% 离散且互不相同，高阶保底校验通过！');
} else {
  console.error('❌ 改运后种子出现碰撞！');
  process.exit(1);
}

console.log('\n=== [4] 校验动态占位符插值与敏感词过滤 ===');
const forbiddenWords = ['死人包', '死人', '{map}', '{spot}', '{container}', '{item}', '{levelName}', '{price}'];
rerolls.forEach((r, idx) => {
  const checkTexts = [
    r.fortune.advice,
    ...(r.almanac ? r.almanac.yi : []),
    ...(r.almanac ? r.almanac.ji : []),
    r.luckyContainer.name,
    r.luckyContainer.desc
  ];

  checkTexts.forEach(text => {
    forbiddenWords.forEach(bad => {
      if (text && text.includes(bad)) {
        console.error(`❌ 发现未替换占位符或违规敏感词: [${bad}] 在文案: "${text}"`);
        process.exit(1);
      }
    });
  });
});
console.log('✅ 所有建议与宜忌中的 {map}/{spot}/{container}/{item}/{levelName} 均已成功插值，且 100% 无敏感词！');

console.log('\n=== [5] 验证多用户与多日期雪崩效应 ===');
const users = ['usr_alice', 'usr_bob', 'usr_charlie', 'usr_david', 'usr_eva'];
users.forEach(u => {
  const r = calculateDailyFortune({ dateStr: testDate, userId: u, rerollCount: 0 });
  console.log(`  用户 ${u.padEnd(12, ' ')}: 地图=${r.luckyMap.name.padEnd(6, ' ')} | 等级=${r.luckyLevel}级 | 道具=${r.luckyItem.name}`);
});

console.log('\n=== [6] 严苛抗压验证: 模拟数据源物理乱序时的防御性表现 ===');
// 篡改 mapManager.mapList 内部顺序 (倒序)
const originalMapList = [...mapManager.mapList];
mapManager.mapList.reverse();

// 篡改 itemManager.levelLists 内部顺序 (倒序)
for (let lvl = 1; lvl <= 6; lvl++) {
  itemManager.levelLists[lvl].reverse();
}

const afterShuffleResult = calculateDailyFortune({ dateStr: testDate, userId: testUser, rerollCount: 0 });
const mapMatch = afterShuffleResult.luckyMap.key === baseline.luckyMap.key;
const itemMatch = afterShuffleResult.luckyItem.id === baseline.luckyItem.id;

if (mapMatch && itemMatch) {
  console.log('✅ 强自然排序防御生效！即使底层数组被完全反转/打乱，计算出的结果依然 100% 绝对一致！');
} else {
  console.error('❌ 底层顺序变动影响了结果！', { baseline, afterShuffleResult });
  process.exit(1);
}

// 恢复原始顺序
mapManager.mapList = originalMapList;
for (let lvl = 1; lvl <= 6; lvl++) {
  itemManager.levelLists[lvl].sort((a, b) => b.price - a.price);
}

console.log('\n=== [7] 校验 6 大地图全图绝对坐标与 8x8 切片矩阵元数据 ===');
const { MAP_LANDMARKS } = require('../miniprogram/games/fortune/fortuneCopywriting');
Object.entries(MAP_LANDMARKS).forEach(([mapKey, mapData]) => {
  console.log(`  核验地图: ${mapData.name} (${mapKey}) 共 ${mapData.landmarks.length} 个官方地标:`);
  mapData.landmarks.forEach(lm => {
    if (!lm.coord || typeof lm.coord.x !== 'number' || typeof lm.coord.y !== 'number') {
      console.error(`❌ 地标 ${lm.name} 缺少合法 coord 坐标！`, lm);
      process.exit(1);
    }
    if (lm.coord.x < 0 || lm.coord.x > 100 || lm.coord.y < 0 || lm.coord.y > 100) {
      console.error(`❌ 地标 ${lm.name} coord 坐标超出 [0, 100]% 范围:`, lm.coord);
      process.exit(1);
    }
    if (!lm.tile || lm.tile.col < 0 || lm.tile.col > 7 || lm.tile.row < 0 || lm.tile.row > 7) {
      console.error(`❌ 地标 ${lm.name} tile 切片超出 8x8 范围:`, lm.tile);
      process.exit(1);
    }
  });
  console.log(`    ✅ 全部 ${mapData.landmarks.length} 个地标坐标与 8x8 切片索引合法且位于全图内！`);
});

console.log('\n🎉 所有算法核心场景与防御性校验全部通过！');
