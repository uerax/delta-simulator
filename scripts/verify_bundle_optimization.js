/**
 * scripts/verify_bundle_optimization.js
 * 全套包体积瘦身与分包架构自动化校验脚本
 * 1. 验证 474 件官方物资紧凑元组解码完整性
 * 2. 验证 ItemManager 全量接口一致性
 * 3. 验证 packageWatermelon 分包物理引擎与核心状态机构造
 * 4. 统计并输出优化前后的主包、分包与全包精确体积变化
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');

// 支持 @/ 别名解析
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    let target = path.resolve(__dirname, '../miniprogram', request.slice(2));
    if (!fs.existsSync(target) && fs.existsSync(target + '.js')) {
      target = target + '.js';
    }
    return target;
  }
  return origResolve.call(this, request, parent, isMain, options);
};

console.log('🧪 开始小程序瘦身与分包架构全量自动化验证...\n');

// -------------------------------------------------------------
// 测试 1: 474 件物资紧凑元组解码与 ItemManager 接口
// -------------------------------------------------------------
console.log('▶ [1/4] 验证 474 件物资紧凑元组解码与 ItemManager 全量接口...');
const itemManifest = require('../miniprogram/assets/items/item_manifest.js');
assert.strictEqual(itemManifest.total, 474, 'item_manifest 总量应为 474');
assert.strictEqual(itemManifest.items.length, 474, 'item_manifest items 数组长度应为 474');
assert.ok(Array.isArray(itemManifest.items[0]), '首个物资应为元组数组');

const ItemManager = require('../miniprogram/utils/itemManager');
ItemManager.init();

const allItems = ItemManager.getAllItems();
assert.strictEqual(allItems.length, 474, 'ItemManager.getAllItems 应返回 474 件物品');

// 抽样断言绝密红品与普通白品
const africaHeart = ItemManager.getById(15080050006);
assert.ok(africaHeart, '应检索到非洲之心');
assert.strictEqual(africaHeart.name, '非洲之心');
assert.strictEqual(africaHeart.level, 6);
assert.strictEqual(africaHeart.price, 13141314);
assert.strictEqual(africaHeart.pic, 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png');
assert.strictEqual(africaHeart.fileName, '15080050006.png');
assert.strictEqual(africaHeart.theme.colorHex, '#E03A3E');

const toothPaste = ItemManager.getByName('含氟牙膏');
assert.ok(toothPaste, '应检索到含氟牙膏');
assert.strictEqual(toothPaste.level, 1);
assert.strictEqual(toothPaste.id, 15010010004);

// 验证 1~6 级各级池非空且降序排列
for (let lvl = 1; lvl <= 6; lvl++) {
  const list = ItemManager.getLevelList(lvl);
  assert.ok(list.length > 0, `第 ${lvl} 级道具列表不应为空`);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].price >= list[i].price, `第 ${lvl} 级道具身价应降序排列`);
  }
}
console.log('✔ 物资元组解码与 ItemManager 474 件全量断言通过！');

// -------------------------------------------------------------
// 测试 2: 分包内 Watermelon 核心引擎与物理库链路
// -------------------------------------------------------------
console.log('\n▶ [2/4] 验证 pages/watermelon 分包物理库与逻辑引擎构造...');
const watermelonItems = require('../miniprogram/pages/watermelon/items');
const watermelonEngine = require('../miniprogram/pages/watermelon/engine');
const physicsPlanck = require('../miniprogram/pages/watermelon/physicsPlanck');

assert.ok(watermelonItems.WATERMELON_ITEMS.length >= 11, '大西瓜应包含 11 阶水果阶梯');
assert.strictEqual(watermelonItems.getItemByLevel(11).name, '非洲之心', '第 11 阶终极果实应为非洲之心');

const pWorld = new physicsPlanck({ width: 360 });
assert.ok(pWorld, '分包内 Planck 物理世界应初始化成功');

const engineInstance = new watermelonEngine({ width: 360 });
assert.ok(engineInstance, '分包内 WatermelonEngine 应构造成功');
assert.strictEqual(engineInstance.gameState, 'ready', '初始状态应为 ready');
console.log('✔ pages/watermelon 分包引擎与物理库实例化验证通过！');

// -------------------------------------------------------------
// 测试 3: 验证主包兼容代理与 manifest 配置
// -------------------------------------------------------------
console.log('\n▶ [3/4] 验证主包兼容代理与 app.json 分包及预下载配置...');
const legacyItems = require('../miniprogram/games/watermelon/items');
assert.strictEqual(legacyItems.getItemByLevel(11).name, '非洲之心', '主包代理 items 应能正常访问分包数据');

const watermelonManifest = require('../miniprogram/games/watermelon/manifest');
assert.strictEqual(watermelonManifest.path, '/pages/watermelon/index', '大西瓜大厅入口路径应更新为分包路由');

const appJson = require('../miniprogram/app.json');
assert.ok(!appJson.pages.includes('pages/watermelon/index'), 'app.json pages 不应再包含大西瓜主包路由');
const subpackages = appJson.subPackages || appJson.subpackages;
assert.ok(Array.isArray(subpackages), 'app.json 应配置 subPackages 数组');
const wmSubpkg = subpackages.find(s => s.root === 'pages/watermelon');
assert.ok(wmSubpkg, 'subPackages 应包含 pages/watermelon 节点');
assert.ok(wmSubpkg.pages.includes('index'), 'pages/watermelon 应包含 index 页面');

assert.ok(appJson.preloadRule, 'app.json 应配置 preloadRule 预下载规则');
assert.ok(appJson.preloadRule['pages/index/index'], '首页应配置分包预下载');
assert.ok(appJson.preloadRule['pages/index/index'].packages.includes('pages/watermelon'), '首页应预下载 pages/watermelon');
console.log('✔ app.json 分包与预下载规则断言通过！');

// -------------------------------------------------------------
// 测试 4: 精确统计全包、主包与分包体积
// -------------------------------------------------------------
console.log('\n▶ [4/4] 统计全包、主包与分包精确体积...');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walk(full));
    } else {
      results.push({ path: full, size: stat.size });
    }
  }
  return results;
}

const miniprogramDir = path.resolve(__dirname, '../miniprogram');
const allFiles = walk(miniprogramDir);
const totalSize = allFiles.reduce((acc, f) => acc + f.size, 0);

const subpackageDir = path.resolve(__dirname, '../miniprogram/pages/watermelon');
const subpkgFiles = allFiles.filter(f => f.path.startsWith(subpackageDir));
const subpkgSize = subpkgFiles.reduce((acc, f) => acc + f.size, 0);

const mainPkgSize = totalSize - subpkgSize;

console.log('\n📊 === 体积优化成果报告 ===');
console.log(`- 优化前总代码包体积: 982.71 KB (1,006,299 bytes)`);
console.log(`- 优化后总代码包体积: ${(totalSize / 1024).toFixed(2)} KB (${totalSize} bytes)`);
console.log(`  └─ 全包总减少体积: ${((1006299 - totalSize) / 1024).toFixed(2)} KB (缩减 ${(((1006299 - totalSize) / 1006299) * 100).toFixed(1)}%)`);
console.log(`\n- 优化前主包 (冷启动) 体积: 982.71 KB`);
console.log(`- 优化后主包 (冷启动) 体积: ${(mainPkgSize / 1024).toFixed(2)} KB (${mainPkgSize} bytes)`);
console.log(`  └─ 主包锐减瘦身体积: ${((1006299 - mainPkgSize) / 1024).toFixed(2)} KB (主包暴瘦 ${(((1006299 - mainPkgSize) / 1006299) * 100).toFixed(1)}%!)`);
console.log(`- 大西瓜独立分包体积: ${(subpkgSize / 1024).toFixed(2)} KB (${subpkgSize} bytes)`);
console.log('============================\n');

console.log('🎉 所有校验与体积对比全部 100% 成功完成！');
