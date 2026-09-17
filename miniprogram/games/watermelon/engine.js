/**
 * 三角洲《合成大西瓜》- 核心逻辑引擎 (WatermelonEngine)
 * 纯 JavaScript 编写，无微信原生环境强依赖，支持单测
 * 包含：动态下落池难度曲线、搜刮身价计分、连续合成连击算法、状态机与反馈调度
 */

const PhysicsWorld = require('./physicsPlanck');
const { WATERMELON_ITEMS, getItemByLevel, MAX_LEVEL } = require('./items');

class WatermelonEngine {
  constructor(options = {}) {
    this.width = options.width || 360;
    this.height = options.height || Math.round(this.width * (976 / 702)); // 严格 1:1 对标斗鱼官方 STAGE_LAYOUT (702:976)
    this.dropY = options.dropY !== undefined ? options.dropY : Math.round(this.height * 0.055); // 待下落果实顶部挂载 Y
    this.dangerY = options.dangerY !== undefined ? options.dangerY : Math.round(this.height * 0.125); // 顶部警戒线 Y (12.5% 高度)

    // 回调函数
    this.onStateChange = options.onStateChange || null;
    this.onScoreUpdate = options.onScoreUpdate || null;
    this.onMerge = options.onMerge || null;
    this.onFruitSpawn = options.onFruitSpawn || null;
    this.onDangerWarning = options.onDangerWarning || null;
    this.onGameOver = options.onGameOver || null;
    this.onFeedback = options.onFeedback || null;
    this.onAimTrail = options.onAimTrail || null; // 瞄准滑动残影拖尾回调

    // 核心游戏状态
    this.gameState = 'ready'; // ready | playing | ended
    this.score = 0;
    this.money = 0; // 搜刮总身价 (金币)
    this.watermelonCount = 0; // 当前局合成非洲之心(大西瓜)个数
    this.dropCount = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.highestLevel = 1;

    this.lastMergeTime = 0;
    this.isDropping = false;
    this.dropCooldown = 0.45; // 单次释放冷却 (秒)
    this.dropCooldownTimer = 0;

    // 1:1 对标斗鱼 Cocos 瞄准滑动补间 (Tween Slide) 与新球登场动效
    this.isAimSliding = false;
    this._aimStartX = 0;
    this._aimTargetX = 0;
    this._aimDuration = 0;
    this._aimElapsed = 0;
    this.heldFruitAlpha = 1.0;
    this.heldFruitAppearDuration = 0;
    this.heldFruitAppearElapsed = 0;

    // 顶部待放置与下一个道具
    this.currentLevel = 1;
    this.nextLevel = 1;
    this.currentFruitX = this.width / 2;
    this._recentDropHistory = [];

    // 初始化 Planck.js 物理世界
    const physicsOptions = {
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
    };

    this.physics = new PhysicsWorld(physicsOptions);

    // 静默初始化
    if (!options.autoInitSilent) {
      this._initFruits();
    } else {
      this.currentLevel = 1;
      this.nextLevel = 1;
    }
  }

  /**
   * 1:1 对标斗鱼 Cocos getStageFruitRadius：获取当前舞台宽度适配后的道具数据
   */
  _getItem(level) {
    return getItemByLevel(level, this.width);
  }

  /**
   * 初始化待下落道具
   */
  _initFruits() {
    this._recentDropHistory = [];
    this.currentLevel = this._generateDropLevel(this.dropCount);
    this.nextLevel = this._generateDropLevel(this.dropCount + 1);
  }

  /**
   * 动态下落池难度曲线算法 (闭环控制器架构: 基础阶梯 + 激活门限 + 读指令对抗 + 濒死安全制动)
   * 1. 基础分阶表: 严格对标原版前 15 次快速进阶至 Lv.7 并封顶
   * 2. 双轨平滑激活门限 (Pacing Gate + Spatial Gate):
   *    - 回合数门限 (turnAlpha): n >= 15 次通过 Smoothstep (S型曲线) 平滑爬升至 22 次拉满
   *    - 空间高度门限 (heightAlpha): 顶部物体越过 50% 高度开始启动，达到 20% 高度拉满
   * 3. 闭环安全制动器 (Pressure Limiter):
   *    - 濒临死亡警戒线时 (离顶部不足 18% 高度)，强制反向衰减对抗强度，阻止系统向濒死盘面疯狂灌大球
   * 4. 读指令对抗卡手修饰器 (Adversarial Modifiers):
   *    - Anti-repeat (0.25x): 刚出过的水果强力冰冻，粉碎双拼连消预期
   *    - Anti-merge (0.55x): 顶层已有同级水果故意降权避让，拒绝无脑消除
   *    - Pressure (1.80x): 比顶层高出 1~2 阶的水果 (C/D/E) 大幅提权，大球压顶
   * 5. 权重混合: weight = baseWeight * (1 - alpha + alpha * modifier)
   */
  _generateDropLevel(n) {
    const baseWeights = this._getBaseWeights(n);
    const alpha = this._calculateAdversarialAlpha(n);
    const modifiers = this._getAdversarialModifiers();

    const finalWeights = {};
    for (const [levelStr, baseWeight] of Object.entries(baseWeights)) {
      const level = Number(levelStr);
      const modifier = modifiers[level] !== undefined ? modifiers[level] : 1.0;
      // 线性插值混合：alpha=0 纯基础表，alpha=1 完全对抗
      const blendedWeight = baseWeight * ((1 - alpha) + alpha * modifier);
      finalWeights[level] = Math.max(blendedWeight, 0.5);
    }

    const chosen = this._weightedPick(finalWeights);
    this._recordDropHistory(chosen);
    return chosen;
  }

  /**
   * 基础分阶权重表 (严格保证等级范围与阶段边界不变)
   */
  _getBaseWeights(n) {
    if (n < 3) {
      // 一开始 (第 0~2 次): 50% 50% (Lv.1~Lv.2)
      return { 1: 50, 2: 50 };
    } else if (n < 6) {
      // 第三次开始 (第 3~5 次): 20% 30% 30% 20% (Lv.1~Lv.4)
      return { 1: 20, 2: 30, 3: 30, 4: 20 };
    } else if (n < 10) {
      // 第六次开始 (第 6~9 次): 10% 20% 30% 30% 10% (Lv.1~Lv.5)
      return { 1: 10, 2: 20, 3: 30, 4: 30, 5: 10 };
    } else if (n < 15) {
      // 第十次开始 (第 10~14 次): 5% 15% 25% 30% 20% 5% (Lv.1~Lv.6)
      return { 1: 5, 2: 15, 3: 25, 4: 30, 5: 20, 6: 5 };
    } else {
      // 第十五次开始 (第 15 次及以后): 1~7 级 (严格封顶于 Lv.7)
      return { 1: 5, 2: 10, 3: 26, 4: 24, 5: 21, 6: 9, 7: 5 };
    }
  }

  /**
   * 计算读指令对抗介入强度 alpha (0.0 ~ 1.0)
   * 双轨触发 (Smoothstep 回合数 + 空间高度) + 濒死压力制动 (Pressure Limiter)
   */
  _calculateAdversarialAlpha(n) {
    const turnAlpha = this._calculateTurnAlpha(n);
    const heightAlpha = this._calculateHeightAlpha();
    const rawAlpha = Math.max(turnAlpha, heightAlpha);

    // 压力制动：在极端濒死状态下卸载对抗强度，避免正反馈将玩家强行处决
    const pressureLimit = this._getPressureLimiter();
    return Math.min(rawAlpha, pressureLimit);
  }

  /**
   * 回合数门限：基于 Smoothstep 的 S 型缓动 (15~22 步)
   */
  _calculateTurnAlpha(n) {
    const t = Math.min(1, Math.max(0, (n - 15) / 7));
    return t * t * (3 - 2 * t);
  }

  /**
   * 空间高度门限：越过 50% 高度开始启动，达到 20% 高度拉满
   */
  _calculateHeightAlpha() {
    const topmostY = this._getTopmostBodyY();
    if (topmostY === null) return 0;

    const activationY = this.height * 0.50; // 300px
    const criticalY = this.height * 0.20;   // 120px

    if (topmostY >= activationY) return 0;
    return Math.min(1.0, Math.max(0, (activationY - topmostY) / (activationY - criticalY)));
  }

  /**
   * 濒死压力制动器：当最顶端物体进入危险区深处时，线性削减对抗强度给玩家翻盘生机
   */
  _getPressureLimiter() {
    const topmostY = this._getTopmostBodyY();
    if (topmostY === null) return 1.0;

    const emergencyY = this.height * 0.18; // 108px (逼近 70px 警戒线)
    if (topmostY < emergencyY) {
      // 越逼近 dangerY (70px)，允许的最大对抗强度越小，回退到基础分布
      const span = emergencyY - this.dangerY;
      return Math.min(1.0, Math.max(0, (topmostY - this.dangerY) / (span > 0 ? span : 1)));
    }
    return 1.0;
  }

  /**
   * 获取物理世界中距离顶部最近的小球上边缘 Y 坐标 (Y 越小越靠近顶部)
   */
  _getTopmostBodyY() {
    if (!this.physics || !this.physics.bodies || this.physics.bodies.length === 0) {
      return null;
    }
    let minY = Infinity;
    for (const b of this.physics.bodies) {
      if (b.isMerging || b.isStatic) continue;
      const topY = b.y - b.radius;
      if (topY < minY) {
        minY = topY;
      }
    }
    return minY === Infinity ? null : minY;
  }

  /**
   * 提取当前物理世界最靠顶部的前 3 颗小球的等级集合
   */
  _getTopHorizonLevels() {
    if (!this.physics || !this.physics.bodies || this.physics.bodies.length === 0) {
      return [];
    }
    const active = this.physics.bodies.filter(b => !b.isMerging && !b.isStatic);
    if (active.length === 0) return [];

    // 按 Y 坐标升序排列 (Y 越小离顶部越近)
    active.sort((a, b) => a.y - b.y);
    const topSlice = active.slice(0, Math.min(3, active.length));
    return topSlice.map(b => b.level);
  }

  /**
   * 纯读指令对抗修饰器字典 (与 alpha 解耦)
   * 返回各等级独立乘数: { [level]: multiplier }
   */
  _getAdversarialModifiers() {
    const modifiers = {};
    const topLevels = this._getTopHorizonLevels();
    const history = this._recentDropHistory || [];
    const lastDrop = history.length > 0 ? history[history.length - 1] : null;
    const maxTopLv = topLevels.length > 0 ? Math.max(...topLevels) : 1;

    for (let lv = 1; lv <= 7; lv++) {
      let mult = 1.0;

      // 1. 刚刚投放过的水果：强力冰冻打折 (0.25x)，破坏双拼预期
      if (lv === lastDrop) {
        mult *= 0.25;
      }

      // 2. 顶层已露出的同级水果：降权回避 (0.55x)，不给容易直接合成的甜头
      if (topLevels.includes(lv)) {
        mult *= 0.55;
      }

      // 3. 跨阶压顶：比顶层露出的最大等级还要高 1~2 阶的 (C/D/E)，大幅提权 1.80x
      if (lv === maxTopLv + 1 || lv === maxTopLv + 2) {
        mult *= 1.80;
      }

      modifiers[lv] = mult;
    }

    return modifiers;
  }

  /**
   * 滑动窗口记录最近 3 次掉落
   */
  _recordDropHistory(lv) {
    if (!this._recentDropHistory) {
      this._recentDropHistory = [];
    }
    this._recentDropHistory.push(lv);
    if (this._recentDropHistory.length > 3) {
      this._recentDropHistory.shift();
    }
  }

  /**
   * 加权轮盘赌抽签
   */
  _weightedPick(weights) {
    const levels = Object.keys(weights).map(Number);
    const total = levels.reduce((sum, lv) => sum + weights[lv], 0);
    let r = Math.random() * total;
    for (const lv of levels) {
      r -= weights[lv];
      if (r <= 0) return lv;
    }
    return levels[levels.length - 1];
  }

  /**
   * 开始游戏
   */
  start() {
    if (this.gameState === 'playing') return;
    this.gameState = 'playing';
    this.score = 0;
    this.money = 0;
    this.watermelonCount = 0;
    this.dropCount = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.highestLevel = 1;
    this._recentDropHistory = [];
    this.isDropping = false;
    this.isAimSliding = false;
    this.dropCooldownTimer = 0;
    this.heldFruitAlpha = 1.0;
    this.heldFruitAppearDuration = 0;
    this.heldFruitAppearElapsed = 0;
    this.physics.clear();
    this._initFruits();

    this._emitState();
    this._emitScore();

    if (typeof this.onFruitSpawn === 'function') {
      this.onFruitSpawn({
        currentLevel: this.currentLevel,
        nextLevel: this.nextLevel,
        currentItem: this._getItem(this.currentLevel),
        nextItem: this._getItem(this.nextLevel)
      });
    }
  }

  /**
   * 重置游戏 (无条件重置状态并启动)
   */
  restart() {
    this.gameState = 'ready';
    this.start();
  }

  /**
   * 移动顶部待放置道具 X 位置 (由触控滑动驱动)
   */
  moveDropper(x) {
    if (this.gameState !== 'playing' || this.isAimSliding) return;
    const currentItem = this._getItem(this.currentLevel);
    const radius = currentItem ? currentItem.radius : 18;

    // 水平位移严格夹紧在容器有效内部
    this.currentFruitX = Math.max(radius, Math.min(this.width - radius, x));
  }

  /**
   * 玩家松开手指，释放道具下落 (1:1 对标斗鱼 Cocos: 瞄准平移 + 残影拖尾 + 垂直下落)
   */
  dropCurrentFruit(targetX = null) {
    if (this.gameState !== 'playing') {
      if (this.gameState === 'ready') {
        this.start();
      } else {
        return false;
      }
    }

    if (this.isDropping || this.isAimSliding || this.dropCooldownTimer > 0) {
      return false;
    }

    const currentItem = this._getItem(this.currentLevel);
    const radius = currentItem ? currentItem.radius : 18;

    const x = targetX !== null ? targetX : this.currentFruitX;
    const clampedX = Math.max(radius, Math.min(this.width - radius, x));
    const r = Math.abs(this.currentFruitX - clampedX);

    // 1:1 对标斗鱼 Cocos dropCurrentFruitAt：
    // 若移动距离大于 1 像素，启动 0.12s ~ 0.22s 的横向瞄准平移动画并生成残影拖尾
    if (r > 1) {
      const duration = Math.min(0.22, Math.max(0.12, r / 1200));
      this.isAimSliding = true;
      this._aimStartX = this.currentFruitX;
      this._aimTargetX = clampedX;
      this._aimDuration = duration;
      this._aimElapsed = 0;
      this.dropCooldownTimer = this.dropCooldown; // 0.45s 冷却从瞄准动作开始计算

      // 派发拖尾生成事件
      if (typeof this.onAimTrail === 'function') {
        this.onAimTrail({
          startX: this._aimStartX,
          targetX: clampedX,
          radius,
          level: this.currentLevel,
          dist: r
        });
      }
      return true;
    }

    // 若当前已在目标点 (r <= 1)，直接原地落体
    this.dropCooldownTimer = this.dropCooldown;
    return this._executeDrop(clampedX, radius);
  }

  /**
   * 物理刚体正式生成下落 (对应斗鱼 finishCurrentFruitDrop)
   */
  _executeDrop(clampedX, radius) {
    // 在物理世界中生成下落刚体 (1:1 对标斗鱼 Cocos: 初速度归零，由 1300 重力自然加速驱动下落)
    const droppedBody = this.physics.createBody(this.currentLevel, clampedX, this.dropY + radius, {
      vx: 0,
      vy: 0
    });

    if (!droppedBody) return false;

    this.dropCount++;
    this.isDropping = true;

    // 触发下落音效/触感反馈
    this._triggerFeedback('drop');

    // 0.20 秒后在顶部生成下一个待落道具 (1:1 对标斗鱼 scheduleOnce(() => spawnNextFruit(), 0.2))
    setTimeout(() => {
      if (this.gameState !== 'playing') return;
      this.currentLevel = this.nextLevel;
      this.nextLevel = this._generateDropLevel(this.dropCount + 1);
      this.isDropping = false;
      this.currentFruitX = clampedX;

      // 1:1 对标斗鱼 playAppear("spawn")：初始透明度 120/255，0.14s 平滑淡入至 255
      this.heldFruitAlpha = 120 / 255;
      this.heldFruitAppearDuration = 0.14;
      this.heldFruitAppearElapsed = 0;

      if (typeof this.onFruitSpawn === 'function') {
        this.onFruitSpawn({
          currentLevel: this.currentLevel,
          nextLevel: this.nextLevel,
          currentItem: this._getItem(this.currentLevel),
          nextItem: this._getItem(this.nextLevel)
        });
      }
    }, 200);

    return true;
  }

  /**
   * 处理物理世界的合成事件
   */
  _handlePhysicsMerge(nextLevel, spawnX, spawnY, newBody) {
    const item = this._getItem(nextLevel);
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

    // 成功合成终极大金·非洲之心 (大西瓜) 计数
    if (nextLevel === 11) {
      this.watermelonCount = (this.watermelonCount || 0) + 1;
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

    // 1:1 对标斗鱼 Cocos 瞄准平移插值补间
    if (this.isAimSliding) {
      this._aimElapsed += dt;
      const p = Math.min(1.0, this._aimElapsed / this._aimDuration);
      // Smoothstep 缓动曲线
      const ease = p * p * (3 - 2 * p);
      this.currentFruitX = this._aimStartX + (this._aimTargetX - this._aimStartX) * ease;

      if (p >= 1.0) {
        this.currentFruitX = this._aimTargetX;
        this.isAimSliding = false;
        const currentItem = this._getItem(this.currentLevel);
        const radius = currentItem ? currentItem.radius : 18;
        this._executeDrop(this._aimTargetX, radius);
      }
    }

    // 1:1 对标斗鱼 Cocos 新水果登场淡入动效
    if (this.heldFruitAppearDuration > 0) {
      this.heldFruitAppearElapsed += dt;
      const p = Math.min(1.0, this.heldFruitAppearElapsed / this.heldFruitAppearDuration);
      this.heldFruitAlpha = (120 + (255 - 120) * p) / 255;
      if (p >= 1.0) {
        this.heldFruitAlpha = 1.0;
        this.heldFruitAppearDuration = 0;
      }
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

    const highestItem = this._getItem(this.highestLevel);

    const gameOverData = {
      score: this.score,
      money: this.money,
      moneyFormatted: this._formatNumber(this.money),
      highestLevel: this.highestLevel,
      highestItem: highestItem ? highestItem.name : '未知',
      maxCombo: this.maxCombo,
      dropCount: this.dropCount,
      watermelonCount: this.watermelonCount || 0
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
    this.isAimSliding = false;
  }

  /**
   * 获取用于首屏合并渲染的初始数据
   */
  getInitialState() {
    const currentItem = this._getItem(this.currentLevel);
    const nextItem = this._getItem(this.nextLevel);

    return {
      gameState: this.gameState,
      score: this.score,
      money: this.money,
      moneyFormatted: '0',
      watermelonCount: this.watermelonCount || 0,
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
        watermelonCount: this.watermelonCount || 0,
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
