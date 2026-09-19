/**
 * scripts/verify_watermelon_hammer.js
 * 水果消除锤 (Hammer) 道具全链路专项测试套件：
 * 1. 物理层 (PhysicsWorldPlanck)：findBodyAt 拾取精准度与最近距离判定、wakeBodiesInRadius 周围唤醒与刚体移除
 * 2. 引擎层 (WatermelonEngine)：toolMode 状态机切换、无目标防御拦截、点击消除流程与生命周期重置
 * 3. 存储层 (Storage)：复用 DAILY_RECORDS 机制，每日首次进入补给 2 把消除锤、持久化扣减与跨天自愈
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

// Mock 微信 Storage 环境
const mockStorageData = {};
global.wx = {
  getStorageSync(key) {
    return mockStorageData[key] || null;
  },
  setStorageSync(key, val) {
    mockStorageData[key] = JSON.parse(JSON.stringify(val));
  }
};

const PhysicsWorldPlanck = require('../miniprogram/games/watermelon/physicsPlanck');
const WatermelonEngine = require('../miniprogram/games/watermelon/engine');
const Storage = require('../miniprogram/utils/storage');

console.log('🔨 开始水果消除锤 (Hammer) 自动化验证套件...\n');

// -------------------------------------------------------------
// 测试 1: 物理层 findBodyAt 与 wakeBodiesInRadius
// -------------------------------------------------------------
console.log('▶ [1/3] 测试物理层 findBodyAt 与 wakeBodiesInRadius...');
const world = new PhysicsWorldPlanck({ width: 360, height: 600 });

// 空场拾取应返回 null
assert.strictEqual(world.findBodyAt(100, 100), null, '空场查找应返回 null');

// 创建两个刚体：b1 在 (100, 200)，半径 20；b2 在 (130, 200)，半径 20
const b1 = world.createBody(1, 100, 200);
const b2 = world.createBody(1, 130, 200);

// 点在 b1 内部 (105, 205) -> 距 b1 为 7.07 <= 20，距 b2 为 25.49 > 20 -> 应该命中 b1
const hit1 = world.findBodyAt(105, 205);
assert.strictEqual(hit1, b1, '应精准拾取小球 b1');

// 点在两者交汇但更接近 b2 的位置 (120, 200) -> 距 b1 为 20，距 b2 为 10 -> 应该命中更近的 b2
const hit2 = world.findBodyAt(120, 200);
assert.strictEqual(hit2, b2, '当重叠区域时应拾取距离更近的小球 b2');

// 点在两球外部 (250, 400) -> 应该未命中
assert.strictEqual(world.findBodyAt(250, 400), null, '外部点应返回 null');

// 测试休眠唤醒
b1._pBody.setAwake(false);
b1.isSleeping = true;
assert.strictEqual(b1._pBody.isAwake(), false, 'b1 应处于休眠状态');

world.wakeBodiesInRadius(100, 200, 50);
assert.strictEqual(b1._pBody.isAwake(), true, 'wakeBodiesInRadius 应唤醒半径内的 b1');

// 移除 b1
world.removeBody(b1);
assert.strictEqual(world.bodies.includes(b1), false, 'removeBody 应将 b1 从 bodies 列表移除');
assert.strictEqual(b1._pBody, null, '刚体 _pBody 应被安全置空');
console.log('  ✔ 物理层拾取与唤醒验证 100% 通过！\n');

// -------------------------------------------------------------
// 测试 2: 引擎层 toolMode 状态机与流程
// -------------------------------------------------------------
console.log('▶ [2/3] 测试 WatermelonEngine 消除锤状态机与使用流程...');
let toolModeEvents = [];
let hammerHitEvents = [];

const engine = new WatermelonEngine({
  width: 360,
  height: 600,
  autoInitSilent: true,
  onToolModeChange: (ev) => {
    toolModeEvents.push(ev);
  },
  onHammerHit: (ev) => {
    hammerHitEvents.push(ev);
  }
});

engine.start();

// 1. 空盘面时无法激活消除锤
assert.strictEqual(engine.activateHammer(), false, '场内无水果时不能激活消除锤');
assert.strictEqual(engine.toolMode, 'none');

// 2. 场内生成水果刚体
const fruitBody = engine.physics.createBody(2, 180, 400);
assert.strictEqual(engine.hasUsableTargets(), true, '此时场内已有可用目标');

// 3. 激活消除锤
const activated = engine.activateHammer();
assert.strictEqual(activated, true, '有水果时应成功激活消除锤');
assert.strictEqual(engine.toolMode, 'hammer');
assert.strictEqual(toolModeEvents[toolModeEvents.length - 1].toolMode, 'hammer');

// 4. 点击空白处 (miss)
const missResult = engine.useHammerAt(20, 20);
assert.strictEqual(missResult.success, false);
assert.strictEqual(missResult.reason, 'miss');
assert.strictEqual(engine.toolMode, 'hammer', '未击中应保持 hammer 激活态');

// 5. 取消激活
engine.cancelHammer();
assert.strictEqual(engine.toolMode, 'none');
assert.strictEqual(toolModeEvents[toolModeEvents.length - 1].toolMode, 'none');

// 6. 重新激活并成功命中目标水果
engine.activateHammer();
const hitResult = engine.useHammerAt(180, 400);
assert.strictEqual(hitResult.success, true);
assert.strictEqual(hitResult.target, fruitBody);
assert.strictEqual(engine.isToolInProgress, true, '命中后应开启 isToolInProgress 互斥');
assert.strictEqual(hammerHitEvents.length, 1, '应触发一次 onHammerHit 事件');

// 7. 完成敲击动画，执行物理移除
engine.executeHammerClear(fruitBody);
assert.strictEqual(engine.toolMode, 'none', '敲击完成后应恢复 none 模式');
assert.strictEqual(engine.isToolInProgress, false, '互斥锁应被释放');
assert.strictEqual(engine.physics.bodies.length, 0, '目标水果应被彻底移除');

// 8. 游戏结束或重新开始应安全重置状态
engine.activateHammer();
engine.end();
assert.strictEqual(engine.toolMode, 'none', '游戏结束应重置 toolMode');
assert.strictEqual(engine.isToolInProgress, false);
console.log('  ✔ 引擎层状态机与消除流程验证 100% 通过！\n');

// -------------------------------------------------------------
// 测试 3: 存储层 Storage 方案 A (DAILY_RECORDS 每日补给与跨天自愈)
// -------------------------------------------------------------
console.log('▶ [3/3] 测试 Storage 每日补给机制 (方案 A)...');

// 首次获取今日消除锤数量，默认应赠送 2 把
const count1 = Storage.getTodayHammerCount();
assert.strictEqual(count1, 2, '首次进入每日应补给 2 把消除锤');

// 消耗 1 把
const count2 = Storage.consumeTodayHammer();
assert.strictEqual(count2, 1, '使用 1 把后应剩余 1 把');

// 再次读取
const count3 = Storage.getTodayHammerCount();
assert.strictEqual(count3, 1, '持久化读取应保持 1 把');

// 消耗第 2 把
const count4 = Storage.consumeTodayHammer();
assert.strictEqual(count4, 0, '使用第 2 把后应剩余 0 把');

// 次数耗尽后再消耗
const count5 = Storage.consumeTodayHammer();
assert.strictEqual(count5, 0, '耗尽后不能低于 0');

// 模拟跨天：篡改当前存储日期
const dailyMap = mockStorageData[Storage.STORAGE_KEYS.DAILY_RECORDS];
const oldDate = Storage.getTodayString();
dailyMap['2020-01-01'] = dailyMap[oldDate];
delete dailyMap[oldDate];

// 跨天后首次进入，应自动刷新补给回 2 把
const nextDayCount = Storage.getTodayHammerCount();
assert.strictEqual(nextDayCount, 2, '新的一天应自动恢复补给 2 把消除锤');
console.log('  ✔ 存储层每日补给与跨天持久化验证 100% 通过！\n');

console.log('🎉 所有单元测试与功能验证 100% 绿色通过！');
