/**
 * 三角洲《合成大西瓜》- 核心逻辑引擎 (WatermelonEngine)
 * 纯 JavaScript 编写，无微信原生环境强依赖，支持单测
 * 包含：动态下落池难度曲线、搜刮身价计分、连续合成连击算法、状态机与反馈调度
 */

const PhysicsWorld = require('./physics');
const { WATERMELON_ITEMS, getItemByLevel, MAX_LEVEL } = require('./items');

class WatermelonEngine {
  constructor(options = {}) {
    this.width = options.width || 360;
    this.height = options.height || 600;
    this.dropY = options.dropY || 40; // 顶部待下落果实的 Y 坐标
    this.dangerY = options.dangerY || 80;

    // 回调函数
    this.onStateChange = options.onStateChange || null;
    this.onScoreUpdate = options.onScoreUpdate || null;
    this.onMerge = options.onMerge || null;
    this.onFruitSpawn = options.onFruitSpawn || null;
    this.onDangerWarning = options.onDangerWarning || null;
    this.onGameOver = options.onGameOver || null;
    this.onFeedback = options.onFeedback || null;

    // 核心游戏状态
    this.gameState = 'ready'; // ready | playing | ended
    this.score = 0;
    this.money = 0; // 搜刮总身价 (金币)
    this.dropCount = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.highestLevel = 1;

    this.lastMergeTime = 0;
    this.isDropping = false;
    this.dropCooldown = 0.45; // 单次释放冷却 (秒)
    this.dropCooldownTimer = 0;

    // 顶部待放置与下一个道具
    this.currentLevel = 1;
    this.nextLevel = 1;
    this.currentFruitX = this.width / 2;

    // 初始化物理世界
    this.physics = new PhysicsWorld({
      width: this.width,
      height: this.height,
      dangerY: this.dangerY,
      onMerge: (b1, b2, nextLevel, spawnX, spawnY, newBody) => {
        this._handlePhysicsMerge(nextLevel, spawnX, spawnY, newBody);
      },
      onDangerWarning: (isWarning) => {
        if (typeof this.onDangerWarning === 'function') {
          this.onDangerWarning(isWarning);
        }
      },
      onDangerLineTrigger: () => {
        this.end();
      }
    });

    // 静默初始化
    if (!options.autoInitSilent) {
      this._initFruits();
    } else {
      this.currentLevel = 1;
      this.nextLevel = 1;
    }
  }

  /**
   * 初始化待下落道具
   */
  _initFruits() {
    this.currentLevel = this._generateDropLevel(this.dropCount);
    this.nextLevel = this._generateDropLevel(this.dropCount + 1);
  }

  /**
   * 动态下落池难度曲线算法 (全新快节奏优化版)
   * 阶梯划分与精准概率：
   * 1. 一开始 (第 0~2 次): 1~2 级 -> 50% 50%
   * 2. 第三次开始 (第 3~5 次): 1~4 级 -> 20% 30% 30% 20%
   * 3. 第六次开始 (第 6~9 次): 1~5 级 -> 10% 20% 30% 30% 10%
   * 4. 第十次开始 (第 10~14 次): 1~6 级 -> 5% 15% 25% 30% 20% 5%
   * 5. 第十五次开始 (第 15 次及以后): 1~7 级 -> 5% 10% 26% 24% 21% 9% 5%
   * 严格封顶于 Lv.7，绝不产出 Lv.8 及以上超大金 (激光陀螺仪/非洲之心等仅限合成)
   */
  _generateDropLevel(n) {
    const r = Math.random();

    if (n < 3) {
      // 一开始 (第 0~2 次): 50% 50% (Lv.1~Lv.2)
      return r < 0.50 ? 1 : 2;
    } else if (n < 6) {
      // 第三次开始 (第 3~5 次): 20% 30% 30% 20% (Lv.1~Lv.4)
      if (r < 0.20) return 1;
      if (r < 0.50) return 2;
      if (r < 0.80) return 3;
      return 4;
    } else if (n < 10) {
      // 第六次开始 (第 6~9 次): 10% 20% 30% 30% 10% (Lv.1~Lv.5)
      if (r < 0.10) return 1;
      if (r < 0.30) return 2;
      if (r < 0.60) return 3;
      if (r < 0.90) return 4;
      return 5;
    } else if (n < 15) {
      // 第十次开始 (第 10~14 次): 5% 15% 25% 30% 20% 5% (Lv.1~Lv.6)
      if (r < 0.05) return 1;
      if (r < 0.20) return 2;
      if (r < 0.45) return 3;
      if (r < 0.75) return 4;
      if (r < 0.95) return 5;
      return 6;
    } else {
      // 第十五次开始 (第 15 次及以后): 5% 10% 26% 24% 21% 9% 5% (Lv.1~Lv.7)
      if (r < 0.05) return 1;
      if (r < 0.15) return 2;
      if (r < 0.41) return 3;
      if (r < 0.65) return 4;
      if (r < 0.86) return 5;
      if (r < 0.95) return 6;
      return 7;
    }
  }

  /**
   * 开始游戏
   */
  start() {
    if (this.gameState === 'playing') return;
    this.gameState = 'playing';
    this.score = 0;
    this.money = 0;
    this.dropCount = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.highestLevel = 1;
    this.physics.clear();
    this._initFruits();

    this._emitState();
    this._emitScore();
  }

  /**
   * 重置游戏
   */
  restart() {
    this.start();
  }

  /**
   * 移动顶部待放置道具 X 位置 (由触控滑动驱动)
   */
  moveDropper(x) {
    if (this.gameState !== 'playing') return;
    const currentItem = getItemByLevel(this.currentLevel);
    const radius = currentItem ? currentItem.radius : 18;

    // 水平位移严格夹紧在容器有效内部
    this.currentFruitX = Math.max(radius, Math.min(this.width - radius, x));
  }

  /**
   * 玩家松开手指，释放道具下落
   */
  dropCurrentFruit(targetX = null) {
    if (this.gameState !== 'playing') {
      if (this.gameState === 'ready') {
        this.start();
      } else {
        return false;
      }
    }

    if (this.isDropping || this.dropCooldownTimer > 0) {
      return false;
    }

    const currentItem = getItemByLevel(this.currentLevel);
    const radius = currentItem ? currentItem.radius : 18;

    const x = targetX !== null ? targetX : this.currentFruitX;
    const clampedX = Math.max(radius, Math.min(this.width - radius, x));

    // 在物理世界中生成下落刚体
    const droppedBody = this.physics.createBody(this.currentLevel, clampedX, this.dropY + radius, {
      vx: 0,
      vy: 60 // 赋予初始下落速度
    });

    if (!droppedBody) return false;

    this.dropCount++;
    this.isDropping = true;
    this.dropCooldownTimer = this.dropCooldown;

    // 触发下落音效/触感反馈
    this._triggerFeedback('drop');

    // 0.20 秒后在顶部生成下一个待落道具 (对标斗鱼节奏)
    setTimeout(() => {
      if (this.gameState !== 'playing') return;
      this.currentLevel = this.nextLevel;
      this.nextLevel = this._generateDropLevel(this.dropCount + 1);
      this.isDropping = false;

      if (typeof this.onFruitSpawn === 'function') {
        this.onFruitSpawn({
          currentLevel: this.currentLevel,
          nextLevel: this.nextLevel,
          currentItem: getItemByLevel(this.currentLevel),
          nextItem: getItemByLevel(this.nextLevel)
        });
      }
    }, 200);

    return true;
  }

  /**
   * 处理物理世界的合成事件
   */
  _handlePhysicsMerge(nextLevel, spawnX, spawnY, newBody) {
    const item = getItemByLevel(nextLevel);
    if (!item) return;

    // 连击判定：1.2 秒内连续合成累加连击
    const now = Date.now();
    if (now - this.lastMergeTime < 1200) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastMergeTime = now;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // 身价增加真实交易行价值，积分增加 2^level * 连击倍率
    const comboMultiplier = 1 + (this.combo - 1) * 0.2;
    const addedScore = Math.round(item.score * comboMultiplier);
    this.score += addedScore;
    this.money += item.price;

    if (nextLevel > this.highestLevel) {
      this.highestLevel = nextLevel;
    }

    // 触发反馈
    const isBigGold = nextLevel >= 9;
    this._triggerFeedback('merge', { combo: this.combo, isBigGold });

    // 广播合成事件
    if (typeof this.onMerge === 'function') {
      this.onMerge({
        level: nextLevel,
        item: item,
        spawnX,
        spawnY,
        combo: this.combo,
        addedScore,
        addedMoney: item.price,
        newBody: newBody
      });
    }

    this._emitScore();
  }

  /**
   * 帧更新驱动 (由 Canvas rAF 驱动)
   */
  update(dt) {
    if (this.gameState !== 'playing') return;

    // 冷却计时
    if (this.dropCooldownTimer > 0) {
      this.dropCooldownTimer = Math.max(0, this.dropCooldownTimer - dt);
    }

    // 驱动物理引擎
    this.physics.update(dt);
  }

  /**
   * 结束游戏
   */
  end() {
    if (this.gameState === 'ended') return;
    this.gameState = 'ended';
    this._triggerFeedback('gameover');

    const highestItem = getItemByLevel(this.highestLevel);

    const gameOverData = {
      score: this.score,
      money: this.money,
      moneyFormatted: this._formatNumber(this.money),
      highestLevel: this.highestLevel,
      highestItem: highestItem ? highestItem.name : '未知',
      maxCombo: this.maxCombo,
      dropCount: this.dropCount
    };

    this._emitState();

    if (typeof this.onGameOver === 'function') {
      this.onGameOver(gameOverData);
    }
  }

  /**
   * 销毁引擎与物理世界
   */
  destroy() {
    this.physics.clear();
    this.gameState = 'ended';
  }

  /**
   * 获取用于首屏合并渲染的初始数据
   */
  getInitialState() {
    const currentItem = getItemByLevel(this.currentLevel);
    const nextItem = getItemByLevel(this.nextLevel);

    return {
      gameState: this.gameState,
      score: this.score,
      money: this.money,
      moneyFormatted: '0',
      combo: this.combo,
      maxCombo: this.maxCombo,
      currentLevel: this.currentLevel,
      nextLevel: this.nextLevel,
      currentItem: currentItem,
      nextItem: nextItem,
      highestLevel: this.highestLevel
    };
  }

  _emitState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({ gameState: this.gameState });
    }
  }

  _emitScore() {
    if (typeof this.onScoreUpdate === 'function') {
      this.onScoreUpdate({
        score: this.score,
        money: this.money,
        moneyFormatted: this._formatNumber(this.money),
        combo: this.combo,
        maxCombo: this.maxCombo,
        highestLevel: this.highestLevel
      });
    }
  }

  _triggerFeedback(type, extra = {}) {
    if (typeof this.onFeedback === 'function') {
      this.onFeedback({ type, ...extra });
    }
  }

  _formatNumber(num) {
    return (num || 0).toLocaleString('en-US');
  }
}

module.exports = WatermelonEngine;
