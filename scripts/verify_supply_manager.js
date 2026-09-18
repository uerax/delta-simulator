const assert = require('assert');
const manifest = require('../miniprogram/assets/supplies/supply_manifest.js');
const SupplyManager = require('../miniprogram/utils/supplyManager.js');

console.log('=== 开始测试 SupplyManager 与 supply_manifest ===');

// 1. 结构与基础字段校验
assert.strictEqual(manifest.total, 47, '去重后应有 47 件独特物资');
assert.strictEqual(manifest.items.length, 47, 'items 数组长度应为 47');
assert(manifest.cdnBaseUrl.includes('img/lv3/'), 'CDN 地址应正确');
console.log('✓ 1. supply_manifest 基础字段与去重条数校验通过 (47件)');

// 2. 检查去重情况
const names = manifest.items.map(i => i.name);
const uniqueNames = new Set(names);
assert.strictEqual(uniqueNames.size, 47, '所有名称必须独一无二无重复');
console.log('✓ 2. 零重复条目校验通过');

// 3. 初始化并测试 SupplyManager
SupplyManager.init();

// 3.1 按名称查
const bxx = SupplyManager.getByName('保险箱');
assert(bxx, '应能检索到保险箱');
assert.strictEqual(bxx.name, '保险箱');
assert.strictEqual(bxx.color, 'red');
assert.strictEqual(bxx.pic, 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/lv3/bxx.png');
console.log('✓ 3. SupplyManager.getByName 校验通过 (动态拼接完整图片URL)');

// 3.2 获取全量物资列表
const all = SupplyManager.getAll();
assert.strictEqual(all.length, 47, '全量列表应包含 47 件物资');
console.log('✓ 4. SupplyManager.getAll 校验通过');

// 4. 特色物资检验
const sjb = SupplyManager.getByName('三角蚌');
assert(sjb, '应包含三角蚌');
assert.strictEqual(sjb.pic, 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/lv3/sjb.png');

const fwq = SupplyManager.getByName('服务器');
assert(fwq, '应包含服务器');
assert.strictEqual(fwq.color, 'orange');

console.log('✓ 5. 特色物资(三角蚌、服务器等)校验通过');

console.log('\n=== 全部单测 100% 绿色通过 ===');
