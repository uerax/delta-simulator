/**
 * ItemManager 道具管理器专项回归测试
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

const assert = require('assert');
const ItemManager = require('../miniprogram/utils/itemManager');

console.log('🧪 开始 ItemManager 道具管理器专项回归测试...\n');

// 1. 测试初始化与防重
console.log('▶ [1/5] 测试初始化构建与防重...');
ItemManager.init();
const allItems = ItemManager.getAll();
assert.strictEqual(allItems.length, 474, '全量道具数应为 474 件');
assert.strictEqual(ItemManager.cdnBaseUrl, 'https://playerhub.df.qq.com/playerhub/60004/object/', 'cdnBaseUrl 应正确读取配置');
console.log(`  ✔ 全量道具总数核验通过: ${allItems.length} 件，CDN 前缀: ${ItemManager.cdnBaseUrl}`);

// 2. 测试 LEVEL_THEMES 视觉主题枚举
console.log('\n▶ [2/5] 测试 LEVEL_THEMES 等级颜色枚举...');
const themes = ItemManager.LEVEL_THEMES;
for (let lvl = 1; lvl <= 6; lvl++) {
  const theme = themes[lvl];
  assert.ok(theme, `等级 ${lvl} 主题应存在`);
  assert.strictEqual(theme.level, lvl);
  assert.ok(theme.bgColor && theme.bgColor.startsWith('#'), `等级 ${lvl} 应有合法的 bgColor`);
  assert.ok(theme.colorHex && theme.colorHex.startsWith('#'), `等级 ${lvl} 应有合法的 colorHex`);
  assert.ok(theme.bgGradient && theme.bgGradient.includes('linear-gradient'), `等级 ${lvl} 应有 bgGradient 渐变`);
  assert.strictEqual(ItemManager.getBgColor(lvl), theme.bgColor, `getBgColor(${lvl}) 快捷方法匹配`);
}
console.log('  ✔ 1~6 级主题枚举与快捷取色验证全部通过！');

// 3. 测试全局双键索引 itemMap
console.log('\n▶ [3/5] 测试全局 itemMap 双键索引 (ID 与 Name)...');
const heartById = ItemManager.getById(15080050006);
const heartByName = ItemManager.getByName('非洲之心');
assert.ok(heartById, '应能按 ID 查到非洲之心');
assert.ok(heartByName, '应能按 Name 查到非洲之心');
assert.strictEqual(heartById.id, heartByName.id, 'ID 与 Name 查到的对象应一致');
assert.strictEqual(heartById.level, 6, '非洲之心应为 6 级');
assert.strictEqual(heartById.priceFormatted, '13,141,314', '千分位金额格式化应正确');
assert.strictEqual(heartById.theme.bgColor, '#361a1c', '绑定的等级底色应正确');
assert.strictEqual(heartById.fileName, '15080050006.png', '纯文件名应为 15080050006.png');
assert.strictEqual(heartById.pic, 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png', '自动拼接的完整 CDN URL 应正确');
console.log(`  ✔ 非洲之心检索: ID=${heartById.id}, 价格=${heartById.priceFormatted}, 底色=${heartById.theme.bgColor}, 图=${heartById.pic}`);

// 4. 测试 1~6 级专属双键 Map (方案 A)
console.log('\n▶ [4/5] 测试 1~6 级专属双键 Map 隔绝性与检索...');
const expectedCounts = {
  1: 47,
  2: 64,
  3: 74,
  4: 101,
  5: 105,
  6: 83
};

for (let lvl = 1; lvl <= 6; lvl++) {
  const map = ItemManager.getLevelMap(lvl);
  const list = ItemManager.getLevelList(lvl);
  assert.ok(map, `level${lvl}Map 应存在`);
  assert.strictEqual(list.length, expectedCounts[lvl], `level${lvl}List 条数应为 ${expectedCounts[lvl]}`);

  // 验证数组已按价格降序排列
  for (let i = 0; i < list.length - 1; i++) {
    assert.ok(list[i].price >= list[i + 1].price, `level${lvl}List 应按价格降序`);
  }
}

// 专项跨级隔离测试
const level6Map = ItemManager.level6Map;
const level1Map = ItemManager.level1Map;

assert.strictEqual(level6Map.has('非洲之心'), true, 'level6Map 应包含非洲之心 (按名)');
assert.strictEqual(level6Map.has(15080050006), true, 'level6Map 应包含非洲之心 (按ID)');
assert.strictEqual(level6Map.has('含氟牙膏'), false, 'level6Map 不应包含 1 级白品含氟牙膏');

assert.strictEqual(level1Map.has('含氟牙膏'), true, 'level1Map 应包含含氟牙膏');
assert.strictEqual(level1Map.has('非洲之心'), false, 'level1Map 不应包含 6 级红品非洲之心');
console.log('  ✔ 1~6 级专属双键 Map 数量、排序、跨级隔离断言全部通过！');

// 5. 测试按等级随机抽取
console.log('\n▶ [5/5] 测试按等级随机抽取 API...');
for (let i = 0; i < 20; i++) {
  const randomGold = ItemManager.getRandomByLevel(6);
  assert.ok(randomGold, '抽取结果不应为空');
  assert.strictEqual(randomGold.level, 6, '抽取出的道具必须严格为 6 级');
}
console.log('  ✔ getRandomByLevel(6) 随机抽取 20 次全部命中 6 级大金！');

console.log('\n🎉 ItemManager 道具管理器所有单测 100% 验证通过！');
