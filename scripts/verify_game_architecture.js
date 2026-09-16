/**
 * scripts/verify_game_architecture.js
 * 验证小游戏解耦架构、核心引擎纯逻辑单测、注册表与存储层兼容性
 */

const assert = require('assert');
const path = require('path');

console.log('🧪 开始小游戏解耦架构全面验证...\n');

// 1. 验证 ReactionEngine (纯 JS 逻辑引擎单测)
console.log('▶ [1/4] 测试 ReactionEngine 纯逻辑引擎...');
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
console.log('  ✔ ReactionEngine 状态流转、目标刷新、计分与回调测试全部通过！\n');

// 2. 验证 SchulteEngine (纯 JS 逻辑引擎单测)
console.log('▶ [2/4] 测试 SchulteEngine 纯逻辑引擎...');
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
console.log('  ✔ SchulteEngine 乱序洗牌、步进校验、自动结算通关测试全部通过！\n');

// 3. 验证 GameRegistry (游戏注册中心)
console.log('▶ [3/4] 测试 GameRegistry 游戏注册中心...');
const GameRegistry = require('../miniprogram/games/registry');

const games = GameRegistry.getAllGames();
assert(Array.isArray(games) && games.length === 3, '当前应注册 3 款小游戏');

const reaction = GameRegistry.getGame('reaction');
assert(reaction && reaction.title === '极速反应挑战', '应能通过 ID 索引极速反应挑战');

const schulte = GameRegistry.getGame('schulte');
assert(schulte && schulte.title === '舒尔特专注方格', '应能通过 ID 索引舒尔特方格');

const fortune = GameRegistry.getGame('fortune');
assert(fortune && fortune.title === '今日鼠鼠运势', '应能通过 ID 索引今日鼠鼠运势');

const mockStats = { highScore: 260, schulteBestTime: 14.5 };
const mockRecords = {
  reaction: { bestScore: 260 },
  schulte: { bestTime: 14.5 },
  fortune: { todayFortune: '大吉·今日必出大金' }
};

const lobbyList = GameRegistry.getLobbyList(mockStats, mockRecords);
assert.strictEqual(lobbyList.length, 3, '大厅卡片数据项数应为 3');
assert.strictEqual(lobbyList[0].id, 'fortune', '首位卡片应为今日鼠鼠运势');
assert(lobbyList[0].iconUrl.includes('15080050006.png'), '首位应引用非洲之心官方CDN图标');
assert.strictEqual(lobbyList[0].recordVal, '大吉·今日必出大金', '运势占卜战绩应正确格式化');
assert.strictEqual(lobbyList[1].id, 'reaction', '第二位卡片应为极速反应挑战');
assert.strictEqual(lobbyList[1].recordVal, '260 分', '反应挑战战绩应正确格式化');
assert.strictEqual(lobbyList[2].id, 'schulte', '第三位卡片应为舒尔特方格');
assert.strictEqual(lobbyList[2].recordVal, '14.5 秒', '舒尔特方格战绩应正确格式化');
console.log('  ✔ GameRegistry 集中管理、配置自描述与大厅卡片动态适配测试通过！\n');

// 4. 验证 Storage 通用按 gameId 命名空间与向下兼容
console.log('▶ [4/4] 测试 Storage 数据层解耦与平滑兼容...');
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

// 测试反应力记录兼容性
const reactionRes = Storage.recordReactionResult(180, 8);
assert(reactionRes.isNewRecord === true, '首次记录应为新纪录');
assert.strictEqual(reactionRes.stats.highScore, 180, '全局 stats.highScore 应同步更新');

// 验证独立命名空间
const reactionGameRecord = Storage.getGameRecord('reaction');
assert(reactionGameRecord !== null, '独立命名空间应存在 reaction 记录');
assert.strictEqual(reactionGameRecord.bestScore, 180, '独立命名空间中 bestScore 应为 180');
assert.strictEqual(reactionGameRecord.bestCombo, 8, '独立命名空间中 bestCombo 应为 8');

// 测试舒尔特记录兼容性
const schulteRes = Storage.recordSchulteResult(12.3);
assert(schulteRes.isNewRecord === true, '首次记录应为新纪录');
assert.strictEqual(schulteRes.stats.schulteBestTime, 12.3, '全局 stats.schulteBestTime 应同步更新');

const schulteGameRecord = Storage.getGameRecord('schulte');
assert(schulteGameRecord !== null, '独立命名空间应存在 schulte 记录');
assert.strictEqual(schulteGameRecord.bestTime, 12.3, '独立命名空间中 bestTime 应为 12.3');

// 再次记录舒尔特更慢成绩，不应刷新最佳
const schulteRes2 = Storage.recordSchulteResult(19.8);
assert(schulteRes2.isNewRecord === false, '较慢成绩不应为新纪录');
assert.strictEqual(Storage.getGameRecord('schulte').bestTime, 12.3, '最佳成绩应维持 12.3');

console.log('  ✔ Storage 通用 gameId 隔离与老接口双向平滑兼容测试通过！\n');

console.log('🎉 所有解耦架构与核心逻辑验证全部 100% 通过！');
