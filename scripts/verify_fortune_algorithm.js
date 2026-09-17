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
console.log(`  - 幸运地图: ${baseline.luckyMap.name} (${baseline.luckyMap.key})`);
console.log(`  - 道具等级: ${baseline.luckyLevel}级 (${baseline.luckyItem.theme.name})`);
console.log(`  - 幸运道具: ${baseline.luckyItem.name} (价格: ¥${baseline.luckyItem.priceFormatted})`);
console.log(`  - 运势评分: ${baseline.fortuneScore}分`);
console.log(`  - 战况吉凶: ${baseline.fortune.sign} · ${baseline.fortune.subTitle}`);
console.log(`  - 战术建议: ${baseline.fortune.advice}`);

let isConsistent = true;
for (let i = 0; i < 100; i++) {
  const current = calculateDailyFortune({ dateStr: testDate, userId: testUser, rerollCount: 0 });
  if (
    current.seed !== baseline.seed ||
    current.luckyMap.key !== baseline.luckyMap.key ||
    current.luckyLevel !== baseline.luckyLevel ||
    current.luckyItem.id !== baseline.luckyItem.id ||
    current.fortune.sign !== baseline.fortune.sign ||
    current.fortune.advice !== baseline.fortune.advice ||
    current.fortuneScore !== baseline.fortuneScore
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
  console.log(`  [改运次数 ${r}${r > 0 ? ' (付费加权)' : ' (免费首次)'}]: 地图=${res.luckyMap.name} | 等级=${res.luckyLevel}级 | 道具=${res.luckyItem.name} | 评价=${res.fortune.sign}`);
}

// 验证改运后种子不同
const distinctSeeds = new Set(rerolls.map(r => r.seed));
if (distinctSeeds.size === rerolls.length) {
  console.log('✅ 付费改运各轮次种子 100% 离散且互不相同！');
} else {
  console.error('❌ 改运后种子出现碰撞！');
  process.exit(1);
}

console.log('\n=== [4] 校验动态占位符插值 ===');
rerolls.forEach((r, idx) => {
  const advice = r.fortune.advice;
  if (advice.includes('{map}') || advice.includes('{item}')) {
    console.error(`❌ 发现未替换的占位符: ${advice}`);
    process.exit(1);
  }
});
console.log('✅ 所有建议文案中的 {map} 与 {item} 均已成功替换为对应战术实体。');

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

console.log('\n🎉 所有算法核心场景与防御性校验全部通过！');
