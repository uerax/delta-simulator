/**
 * scripts/verify_tiered_watermelon_items.js
 * 专项验证 2~5 级道具价格半区分档方案 A (Tiered Random Items)
 * 1. 验证 ItemManager.getRandomByLevel 的 tier ('high' / 'low' / 'all') 分档逻辑
 * 2. 验证 0 元道具的自动过滤与兜底保护
 * 3. 验证《合成大西瓜》连续 100 次局内随机道具刷新的身价递增与零倒挂表现
 */

const assert = require('assert');
const path = require('path');
const Module = require('module');

// 支持 @/ 别名解析
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(__dirname, '../miniprogram', request.slice(2));
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const ItemManager = require('../miniprogram/utils/itemManager');
const { WATERMELON_ITEMS, refreshWatermelonItems } = require('../miniprogram/games/watermelon/items');

console.log('🧪 开始 2~5 级道具方案 A (价格半区分档) 专项验证...\n');

// -------------------------------------------------------------
// 测试 1: ItemManager.getRandomByLevel 半区分档功能
// -------------------------------------------------------------
console.log('▶ [1/3] 测试 ItemManager.getRandomByLevel 半区分档与零元过滤...');

for (let lvl = 2; lvl <= 5; lvl++) {
  const fullList = ItemManager.getLevelList(lvl);
  const validList = fullList.filter(x => x.price > 0);
  const mid = Math.floor(validList.length / 2);
  const minHighPrice = validList[mid - 1].price;
  const maxLowPrice = validList[mid].price;

  // 连续抽取 30 次高价档与低价档
  for (let i = 0; i < 30; i++) {
    const highItem = ItemManager.getRandomByLevel(lvl, null, 'high');
    const lowItem = ItemManager.getRandomByLevel(lvl, null, 'low');

    assert(highItem, `${lvl}级高价抽取不能为空`);
    assert(lowItem, `${lvl}级低价抽取不能为空`);
    assert(highItem.price > 0, `高价道具不能为 0 元: ${highItem.name}`);
    assert(lowItem.price > 0, `低价道具不能为 0 元: ${lowItem.name}`);
    assert(highItem.price >= minHighPrice, `${lvl}级高价道具身价(${highItem.price})应在前半区(>=${minHighPrice})`);
    assert(lowItem.price <= maxLowPrice, `${lvl}级平价道具身价(${lowItem.price})应在后半区(<=${maxLowPrice})`);
  }
}
console.log('  ✔ ItemManager 半区分档与边界断言 100% 通过！\n');

// -------------------------------------------------------------
// 测试 2: 合成大西瓜 refreshWatermelonItems 100 轮蒙特卡洛随机测试
// -------------------------------------------------------------
console.log('▶ [2/3] 模拟合成大西瓜 100 轮局内道具刷新，核验同品质内部身价递增...');

let sampleOutput = null;

for (let round = 1; round <= 100; round++) {
  const items = refreshWatermelonItems();

  // 1. 验证 11 件道具 ID 全局互不重复
  const ids = items.map(x => x.id);
  const idSet = new Set(ids);
  assert.strictEqual(idSet.size, 11, `第 ${round} 轮存在重复道具 ID`);

  // 2. 验证 Lv.11 必须是非洲之心
  assert.strictEqual(items[10].level, 11);
  assert.strictEqual(items[10].name, '非洲之心');

  // 3. 验证 2~5 级（对应西瓜 Lv.2~Lv.9）内部同级两两成对身价必须严格满足 Lv.小 < Lv.大
  // Lv.2 (平价绿) vs Lv.3 (高价绿)
  assert(items[1].price < items[2].price, `第 ${round} 轮绿品倒挂: ${items[1].name}(¥${items[1].price}) >= ${items[2].name}(¥${items[2].price})`);

  // Lv.4 (平价蓝) vs Lv.5 (高价蓝)
  assert(items[3].price < items[4].price, `第 ${round} 轮蓝品倒挂: ${items[3].name}(¥${items[3].price}) >= ${items[4].name}(¥${items[4].price})`);

  // Lv.6 (平价紫) vs Lv.7 (高价紫)
  assert(items[5].price < items[6].price, `第 ${round} 轮紫品倒挂: ${items[5].name}(¥${items[5].price}) >= ${items[6].name}(¥${items[6].price})`);

  // Lv.8 (平价橙) vs Lv.9 (高价橙)
  assert(items[7].price < items[8].price, `第 ${round} 轮橙品倒挂: ${items[7].name}(¥${items[7].price}) >= ${items[8].name}(¥${items[8].price})`);

  // 4. 验证不存在 0 元道具
  for (let i = 0; i < items.length; i++) {
    assert(items[i].price > 0, `第 ${round} 轮道具 ${items[i].name} 身价不能为 0`);
  }

  if (round === 1) {
    sampleOutput = items.map(it => `Lv.${it.level} [grade ${it.grade}] ${it.name.padEnd(12, ' ')} 身价: ¥${it.price.toLocaleString()}`);
  }
}

console.log('  ✔ 100 轮局内刷新全部通过，同品质双阶道具 100% 递增且零倒挂！\n');

// -------------------------------------------------------------
// 测试 3: 展示抽样示例局内身价分布
// -------------------------------------------------------------
console.log('▶ [3/3] 抽样第一轮局内 11 阶道具阶梯分布:');
sampleOutput.forEach(line => console.log('  ', line));

console.log('\n🎉 方案 A (价格半区分档) 专项验证全部 100% 绿色通过！');
