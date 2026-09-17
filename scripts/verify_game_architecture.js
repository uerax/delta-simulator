/**
 * scripts/verify_game_architecture.js
 * 验证小游戏解耦架构、核心引擎纯逻辑单测、注册表与存储层兼容性
 */

const assert = require('assert');
const path = require('path');

console.log('🧪 开始小游戏解耦架构全面验证...\n');

// 1. 验证 ReactionEngine (纯 JS 逻辑引擎单测)
console.log('▶ [1/6] 测试 ReactionEngine 纯逻辑引擎...');
const ReactionEngine = require('../miniprogram/games/reaction/engine');

let reactionTickCount = 0;
let reactionState = '';
let reactionLastScore = 0;
let reactionFeedback = null;
let reactionGameOverData = null;

const reactionEngine = new ReactionEngine({
  totalDuration: 5,
  gridSize: 9,
  onTick: ({ timeLeft }) => {
    reactionTickCount++;
  },
  onStateChange: ({ gameState }) => {
    reactionState = gameState;
  },
  onScoreUpdate: ({ score, combo, maxCombo }) => {
    reactionLastScore = score;
  },
  onFeedback: (fb) => {
    reactionFeedback = fb;
  },
  onGameOver: (data) => {
    reactionGameOverData = data;
  }
});

assert.strictEqual(reactionEngine.gameState, 'ready', '初始状态应为 ready');
assert.strictEqual(reactionEngine.gridCells.length, 9, '初始方格数应为 9');

// 开始游戏
reactionEngine.start();
assert.strictEqual(reactionEngine.gameState, 'playing', 'start 后状态应为 playing');
assert(reactionEngine.activeIndex >= 0 && reactionEngine.activeIndex < 9, '靶心索引应合法');

// 模拟命中正确靶心
const target = reactionEngine.activeIndex;
reactionEngine.handleCellTap(target);
assert.strictEqual(reactionFeedback.type, 'hit', '点击靶心应触发 hit 反馈');
assert(reactionLastScore >= 10, '命中后得分应增加至少 10');
assert.strictEqual(reactionEngine.combo, 1, '连击数应为 1');

// 模拟点击错误方格
const wrong = (reactionEngine.activeIndex + 1) % 9;
reactionEngine.handleCellTap(wrong);
assert.strictEqual(reactionFeedback.type, 'miss', '点击非靶心应触发 miss 反馈');
assert.strictEqual(reactionEngine.combo, 0, '点错后连击数应归零');

// 结束游戏
reactionEngine.end();
assert.strictEqual(reactionEngine.gameState, 'ended', 'end 后状态应为 ended');
assert(reactionGameOverData !== null, '应正确触发 onGameOver 回调');
reactionEngine.destroy();

// 验证 ReactionEngine autoInitSilent 与 getInitialState
const silentReaction = new ReactionEngine({ totalDuration: 30, gridSize: 9, autoInitSilent: true });
const initialDataReaction = silentReaction.getInitialState();
assert.strictEqual(initialDataReaction.gameState, 'ready');
assert.strictEqual(initialDataReaction.timeLeft, 30);
assert.strictEqual(initialDataReaction.gridCells.length, 9);
silentReaction.destroy();
console.log('  ✔ ReactionEngine 状态流转、目标刷新、计分与静默批处理测试全部通过！\n');

// 2. 验证 SchulteEngine (纯 JS 逻辑引擎单测)
console.log('▶ [2/6] 测试 SchulteEngine 纯逻辑引擎...');
const SchulteEngine = require('../miniprogram/games/schulte/engine');

let schulteState = '';
let schulteFeedback = null;
let schulteGameOverData = null;

const schulteEngine = new SchulteEngine({
  totalNumbers: 16,
  onStateChange: ({ gameState }) => {
    schulteState = gameState;
  },
  onFeedback: (fb) => {
    schulteFeedback = fb;
  },
  onGameOver: (data) => {
    schulteGameOverData = data;
  }
});

assert.strictEqual(schulteEngine.gameState, 'ready', '初始状态应为 ready');
assert.strictEqual(schulteEngine.gridNumbers.length, 16, '初始方格数应为 16');

// 验证 1-16 乱序完整性
const numsSet = new Set(schulteEngine.gridNumbers.map(g => g.num));
assert.strictEqual(numsSet.size, 16, '方格应包含 1-16 不重复数字');

schulteEngine.start();
assert.strictEqual(schulteEngine.gameState, 'playing', 'start 后状态应为 playing');

// 模拟点错数字
const wrongIdx = schulteEngine.gridNumbers.findIndex(g => g.num !== 1);
schulteEngine.handleBoxTap(wrongIdx);
assert.strictEqual(schulteFeedback.type, 'miss', '未按序点击应触发 miss 反馈');

// 模拟依次点完 1 到 16
for (let target = 1; target <= 16; target++) {
  const correctIdx = schulteEngine.gridNumbers.findIndex(g => g.num === target);
  schulteEngine.handleBoxTap(correctIdx);
  assert.strictEqual(schulteFeedback.type, 'hit', `点击数字 ${target} 应触发 hit`);
}

assert.strictEqual(schulteEngine.gameState, 'ended', '点完 16 个数字后应自动结算通关');
assert(schulteGameOverData !== null, '通关应触发 onGameOver 回调');
assert(['王者专注', '极佳', '优秀', '良好'].includes(schulteGameOverData.rating), '评级应符合规范');
schulteEngine.destroy();

// 验证 SchulteEngine autoInitSilent 与 getInitialState
const silentSchulte = new SchulteEngine({ totalNumbers: 16, autoInitSilent: true });
const initialDataSchulte = silentSchulte.getInitialState();
assert.strictEqual(initialDataSchulte.gameState, 'ready');
assert.strictEqual(initialDataSchulte.currentTarget, 1);
assert.strictEqual(initialDataSchulte.gridNumbers.length, 16);
silentSchulte.destroy();
console.log('  ✔ SchulteEngine 乱序洗牌、步进校验、自动结算通关与静默批处理测试全部通过！\n');

// 3. 验证 WatermelonEngine & PhysicsWorld (合成大西瓜物理与逻辑引擎)
console.log('▶ [3/6] 测试 WatermelonEngine 逻辑与 PhysicsWorld 刚体物理引擎...');
const { WATERMELON_ITEMS, getItemByLevel, MAX_LEVEL } = require('../miniprogram/games/watermelon/items');
const PhysicsWorld = require('../miniprogram/games/watermelon/physicsPlanck');
const WatermelonEngine = require('../miniprogram/games/watermelon/engine');

// 3.1 道具元数据 11 阶验证
assert.strictEqual(WATERMELON_ITEMS.length, 11, '道具清单应包含严格 11 个品阶');
assert.strictEqual(WATERMELON_ITEMS[0].name, '含氟牙膏', 'Lv.1 道具应为含氟牙膏');
assert.strictEqual(WATERMELON_ITEMS[10].name, '非洲之心', 'Lv.11 终极大金应为非洲之心');
assert(WATERMELON_ITEMS[10].iconUrl.includes('15080050006.png'), '终极大金应直连非洲之心官方CDN');
assert.strictEqual(MAX_LEVEL, 11, '最大等级应为 11');

// 3.2 动态下落池难度曲线算法 (全新快节奏：一开始1~2级，前15次快速进阶至Lv.7)
const watermelonEngine = new WatermelonEngine({ width: 360, height: 600, autoInitSilent: true });
for (let i = 0; i < 50; i++) {
  const lvInitial = watermelonEngine._generateDropLevel(0);
  assert(lvInitial >= 1 && lvInitial <= 2, '一开始只能产出 Lv.1 ~ Lv.2 (50% 50%)');
}

for (let i = 0; i < 50; i++) {
  const lvFrom3 = watermelonEngine._generateDropLevel(3);
  assert(lvFrom3 >= 1 && lvFrom3 <= 4, '第三次开始产出 Lv.1 ~ Lv.4');
}

for (let i = 0; i < 50; i++) {
  const lvFrom15 = watermelonEngine._generateDropLevel(15);
  assert(lvFrom15 >= 1 && lvFrom15 <= 7, '第十五次开始最高可出现 Lv.7，严禁产出 Lv.8 及以上');
}

// 3.3 物理碰撞与合成机制验证 (含 pickLowerFruit 靠下锚定与冲击波)
let mergeTriggered = false;
let mergedLevel = 0;
let mergedSpawnY = 0;

const testWorld = new PhysicsWorld({
  width: 360,
  height: 600,
  onMerge: (b1, b2, nextLevel, spawnX, spawnY) => {
    mergeTriggered = true;
    mergedLevel = nextLevel;
    mergedSpawnY = spawnY;
  }
});

// 在物理世界中加入两颗互相重叠的 Lv.1 小球 (b1 在上 y=400, b2 在下 y=420)
const b1 = testWorld.createBody(1, 100, 400);
const b2 = testWorld.createBody(1, 100, 420);
assert.strictEqual(testWorld.bodies.length, 2, '初始应成功创建 2 个刚体');

// 运行物理更新帧
testWorld.update(0.016);
assert.strictEqual(mergeTriggered, true, '两颗重叠 Lv.1 小球应成功触发合成');
assert.strictEqual(mergedLevel, 2, '合成后等级应晋升为 Lv.2');
assert(mergedSpawnY >= 420, '核心手感验证：新小球生成锚点应严格靠下 (pickLowerFruit 算法生效)');
assert.strictEqual(testWorld.bodies.length, 1, '旧刚体应被移除，物理世界应保留新合成的刚体');
assert.strictEqual(testWorld.bodies[0].level, 2, '保留刚体应为 Lv.2');

// 3.4 警戒线与 0.8 秒滞留死亡模型验证
let dangerLineHit = false;
const dangerWorld = new PhysicsWorld({
  width: 360,
  height: 600,
  gravity: 0,
  dangerY: 100,
  dangerDwellTime: 0.8,
  onDangerLineTrigger: () => {
    dangerLineHit = true;
  }
});

// 在警戒线上方创建静止刚体 (y=80 < dangerY=100)
const highBall = dangerWorld.createBody(1, 180, 80, { isStatic: false });
highBall.age = 1.1; // 越过 1.0s 新生保护期
highBall.vx = 0;
highBall.vy = 0;

// 更新 25 帧 * 0.016s = 0.4s (未达到 0.8s 阈值)
for (let f = 0; f < 25; f++) {
  dangerWorld.update(0.016);
}
assert.strictEqual(dangerLineHit, false, '滞留未满 0.8 秒严禁触发游戏结束');

// 再次更新 35 帧 * 0.016s = 0.56s (累计约 0.96s > 0.8s)
for (let f = 0; f < 35; f++) {
  dangerWorld.update(0.016);
}
assert.strictEqual(dangerLineHit, true, '稳定滞留超过 0.8 秒应正确触发警戒线死亡');

// 3.5 WatermelonEngine 完整游玩流程验证
let engineMerged = false;
let engineGameOver = false;

const fullEngine = new WatermelonEngine({
  width: 360,
  height: 600,
  onMerge: () => { engineMerged = true; },
  onGameOver: () => { engineGameOver = true; }
});

fullEngine.start();
assert.strictEqual(fullEngine.gameState, 'playing', 'start 后引擎状态应为 playing');
assert.strictEqual(fullEngine.score, 0, '初始得分应为 0');
assert.strictEqual(fullEngine.money, 0, '初始搜刮身价应为 0');

// 模拟下落道具
const dropSuccess = fullEngine.dropCurrentFruit(180);
assert.strictEqual(dropSuccess, true, '合法状态下放置道具应成功');
assert.strictEqual(fullEngine.dropCount, 1, '下落计数应加 1');

// 测试冷却拦截
const dropBlocked = fullEngine.dropCurrentFruit(180);
assert.strictEqual(dropBlocked, false, '冷却时间内连续点击应被拦截防呆');

// 3.5.1 对标斗鱼 Cocos：松手瞄准平移插值、残影拖尾与到位下落全流程
let aimTrailData = null;
const aimEngine = new WatermelonEngine({
  width: 360,
  height: 600,
  onAimTrail: (data) => { aimTrailData = data; }
});
aimEngine.start();
aimEngine.moveDropper(180);
const slideSuccess = aimEngine.dropCurrentFruit(80);
assert.strictEqual(slideSuccess, true, '合法状态下松手应成功接管');
assert.strictEqual(aimEngine.isAimSliding, true, '移动距离 > 1px 应进入瞄准滑行状态');
assert(aimTrailData !== null, '瞄准滑行应触发残影拖尾派发');
assert.strictEqual(aimTrailData.dist, 100, '拖尾距离应准确匹配');

aimEngine.update(0.05);
assert(aimEngine.currentFruitX < 180 && aimEngine.currentFruitX > 80, '更新帧中应沿缓动曲线平滑平移');

aimEngine.update(0.20);
assert.strictEqual(aimEngine.isAimSliding, false, '滑行完毕应退出滑行状态');
assert.strictEqual(aimEngine.currentFruitX, 80, '滑行结束应精准到位');
assert.strictEqual(aimEngine.isDropping, true, '滑行到位后应正式转为刚体下落');
aimEngine.destroy();

// 3.6 核心对标验证：两球接触切向表面速度差耦合、库仑摩擦制动与绝无 NaN
const frictionWorld = new PhysicsWorld({ width: 360, height: 600 });
// 创建两颗不同等级（无法合成）的刚体，接触并置于地面上
const rollB1 = frictionWorld.createBody(1, 100, 600 - 18);
const rollB2 = frictionWorld.createBody(3, 100 + 18 + 28 - 2, 600 - 28);
rollB1.angularVelocity = 10; // 初始自旋
rollB2.angularVelocity = 0;

for (let f = 0; f < 60; f++) {
  frictionWorld.update(0.016);
  assert(!isNaN(rollB1.angularVelocity), '自旋角速度严禁出现 NaN');
  assert(!isNaN(rollB2.angularVelocity), '被接触球角速度严禁出现 NaN');
}
assert(rollB1.angularVelocity < 3.0, '接触摩擦与角阻尼应有效抑制自旋，禁止无限自转');
assert(rollB1.angularVelocity >= 0, '角速度衰减方向应平稳且自洽');

// 3.7 核心手感验证：地面接触纯滚动驱动与静止休眠
const groundWorld = new PhysicsWorld({ width: 360, height: 600 });
const dropBall = groundWorld.createBody(1, 180, 500, { vx: 80, vy: 0 });
// 运行物理模拟至小球平抛落地撞墙并自然滚停休眠 (约 3.8 秒，240 帧)
for (let f = 0; f < 240; f++) {
  groundWorld.update(0.016);
}
assert(dropBall.y >= 600 - 18 - 1, '小球应落在地面');
assert(Math.abs(dropBall.vx) < 5, '在地面滚动摩擦作用下水平速度应显著衰减');

fullEngine.destroy();
console.log('  ✔ WatermelonEngine 难度曲线、手感锚定、冲击波、0.8s 警戒线与 Box2D 切向接触摩擦测试通过！\n');

// 4. 验证 GameRegistry (游戏注册中心与展位顺序)
console.log('▶ [4/6] 测试 GameRegistry 游戏注册中心...');
const GameRegistry = require('../miniprogram/games/registry');

const games = GameRegistry.getAllGames();
assert(Array.isArray(games) && games.length === 4, '当前应注册 4 款小游戏');

// 重点验证顺序：首位为今日鼠鼠运势，第二位为合成大西瓜！
assert.strictEqual(games[0].id, 'fortune', '首位游戏应为今日鼠鼠运势');
assert.strictEqual(games[1].id, 'watermelon', '核心需求验证：第二位游戏应放置合成大西瓜');
assert.strictEqual(games[1].title, '合成大西瓜', '第二位游戏标题应为合成大西瓜');
assert.strictEqual(games[2].id, 'reaction', '第三位游戏应为极速反应挑战');
assert.strictEqual(games[3].id, 'schulte', '第四位游戏应为舒尔特方格');

const mockStats = { highScore: 260, schulteBestTime: 14.5 };
const mockRecords = {
  fortune: { todayFortune: '大吉·今日必出大金' },
  watermelon: { bestMoney: 12484244, bestMoneyFormatted: '12,484,244' },
  reaction: { bestScore: 260 },
  schulte: { bestTime: 14.5 }
};

const lobbyList = GameRegistry.getLobbyList(mockStats, mockRecords);
assert.strictEqual(lobbyList.length, 4, '大厅卡片数据项数应为 4');
assert.strictEqual(lobbyList[0].id, 'fortune');
assert.strictEqual(lobbyList[1].id, 'watermelon', '大厅第 2 张卡片应为合成大西瓜');
assert.strictEqual(lobbyList[1].recordVal, '12,484,244 金币', '合成大西瓜战绩应正确展现最高搜刮身价');
assert.strictEqual(lobbyList[2].id, 'reaction');
assert.strictEqual(lobbyList[3].id, 'schulte');
console.log('  ✔ GameRegistry 集中管理、第二展位精准排列与大厅卡片动态适配测试通过！\n');

// 5. 验证 Storage 数据层解耦与平滑兼容
console.log('▶ [5/6] 测试 Storage 数据层解耦与平滑兼容...');
// 模拟全局 wx.getStorageSync / wx.setStorageSync
const mockStorage = {};
global.wx = {
  getStorageSync(key) {
    return mockStorage[key] || null;
  },
  setStorageSync(key, val) {
    mockStorage[key] = JSON.parse(JSON.stringify(val));
  },
  removeStorageSync(key) {
    delete mockStorage[key];
  }
};

const Storage = require('../miniprogram/utils/storage');

// 测试合成大西瓜战绩写入与独立命名空间
const watermelonRes = Storage.recordWatermelonResult({
  score: 1560,
  money: 12484244,
  highestLevel: 11,
  highestItem: '非洲之心',
  maxCombo: 6
});

assert(watermelonRes.isNewRecord === true, '首次记录应为新纪录');
const watermelonGameRecord = Storage.getGameRecord('watermelon');
assert(watermelonGameRecord !== null, '独立命名空间中应存在 watermelon 记录');
assert.strictEqual(watermelonGameRecord.bestMoney, 12484244, '最高搜刮身价应为 12484244');
assert.strictEqual(watermelonGameRecord.bestLevel, 11, '最高等级应为 11');
assert.strictEqual(watermelonGameRecord.lastHighestItem, '非洲之心', '最高道具应记录为非洲之心');

// 测试反应力记录兼容性
const reactionRes = Storage.recordReactionResult(180, 8);
assert(reactionRes.isNewRecord === true, '首次记录应为新纪录');
assert.strictEqual(reactionRes.stats.highScore, 180, '全局 stats.highScore 应同步更新');

// 测试舒尔特记录兼容性
const schulteRes = Storage.recordSchulteResult(12.3);
assert(schulteRes.isNewRecord === true, '首次记录应为新纪录');
assert.strictEqual(schulteRes.stats.schulteBestTime, 12.3, '全局 stats.schulteBestTime 应同步更新');

console.log('  ✔ Storage 通用 gameId 隔离与合成大西瓜专属持久化测试通过！\n');

// 6. 验证 Feedback 触感模块与开发者工具自适应
console.log('▶ [6/6] 测试 Feedback 触感反馈与模拟器自适应...');
const Feedback = require('../miniprogram/utils/feedback');

// 验证无 wx 环境下安全容错
Feedback.vibrateShort(true, 'light');
Feedback.vibrateLong(true);

// 模拟 devtools 环境
global.wx.getSystemInfoSync = () => ({ platform: 'devtools' });
// 重新加载以测试缓存
delete require.cache[require.resolve('../miniprogram/utils/feedback')];
const DevToolsFeedback = require('../miniprogram/utils/feedback');
assert.strictEqual(DevToolsFeedback.isDevTools(), true, '应精准识别 devtools 开发者工具');

let vibrateCalled = false;
global.wx.vibrateShort = () => { vibrateCalled = true; };
DevToolsFeedback.vibrateShort(true, 'light');
assert.strictEqual(vibrateCalled, false, '在 devtools 环境下应跳过原生震动防止 IPC 阻塞');

// 模拟真机 ios 环境
delete require.cache[require.resolve('../miniprogram/utils/feedback')];
global.wx.getSystemInfoSync = () => ({ platform: 'ios' });
const RealDeviceFeedback = require('../miniprogram/utils/feedback');
assert.strictEqual(RealDeviceFeedback.isDevTools(), false, '应精准识别真机环境');

RealDeviceFeedback.vibrateShort(true, 'light');
assert.strictEqual(vibrateCalled, true, '在真机环境下开启震动应正常触发原生震动');

// 开关为 false 时应不触发
vibrateCalled = false;
RealDeviceFeedback.vibrateShort(false, 'light');
assert.strictEqual(vibrateCalled, false, '用户关闭震动开关时严禁触发震动');

console.log('  ✔ Feedback 开发者工具自适应跳过与真机开关响应逻辑全部通过！\n');

console.log('🎉 所有解耦架构与核心逻辑验证全部 100% 通过！');
