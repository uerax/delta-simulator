/**
 * 极速反应挑战 - 纯 JavaScript 核心逻辑引擎
 * 零依赖微信环境，独立可单测
 */

class ReactionEngine {
  constructor(options = {}) {
    this.totalDuration = options.totalDuration || 30; // 默认30秒
    this.gridSize = options.gridSize || 9;            // 默认3x3九宫格

    // 回调钩子
    this.onTick = options.onTick || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onBoardUpdate = options.onBoardUpdate || (() => {});
    this.onScoreUpdate = options.onScoreUpdate || (() => {});
    this.onFeedback = options.onFeedback || (() => {});
    this.onGameOver = options.onGameOver || (() => {});

    // 内部状态
    this.gameState = 'ready'; // 'ready' | 'playing' | 'ended'
    this.timeLeft = this.totalDuration;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.activeIndex = -1;
    this.gridCells = [];

    this._timer = null;
    this._wrongResetTimer = null;

    this.init();
  }

  /**
   * 初始化/重置棋盘与基础数据
   */
  init() {
    this.clearAllTimers();
    this.gameState = 'ready';
    this.timeLeft = this.totalDuration;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.activeIndex = -1;

    this.gridCells = Array.from({ length: this.gridSize }, () => ({
      isActive: false,
      isWrong: false
    }));

    this.onStateChange({ gameState: this.gameState });
    this.onTick({ timeLeft: this.timeLeft });
    this.onScoreUpdate({
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo
    });
    this.onBoardUpdate({
      gridCells: this.gridCells,
      activeIndex: this.activeIndex
    });
  }

  /**
   * 开始游戏
   */
  start() {
    this.init();
    this.gameState = 'playing';
    this.onStateChange({ gameState: this.gameState });
    this.spawnTarget();

    this._timer = setInterval(() => {
      this.timeLeft -= 1;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.onTick({ timeLeft: 0 });
        this.end();
      } else {
        this.onTick({ timeLeft: this.timeLeft });
      }
    }, 1000);
  }

  /**
   * 刷新下一个靶心位置
   */
  spawnTarget() {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * this.gridSize);
    } while (nextIndex === this.activeIndex && this.gridSize > 1);

    this.activeIndex = nextIndex;
    this.gridCells = this.gridCells.map((cell, idx) => ({
      isActive: idx === nextIndex,
      isWrong: false
    }));

    this.onBoardUpdate({
      gridCells: this.gridCells,
      activeIndex: this.activeIndex
    });
  }

  /**
   * 响应格子点击
   * @param {number} clickedIndex
   */
  handleCellTap(clickedIndex) {
    if (this.gameState !== 'playing') return;

    if (clickedIndex === this.activeIndex) {
      // 点击正确
      this.combo += 1;
      const addScore = 10 + Math.floor(this.combo / 3) * 5; // 连击得分加成
      this.score += addScore;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      this.onFeedback({ type: 'hit', index: clickedIndex });
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo
      });

      this.spawnTarget();
    } else {
      // 点击错误
      this.combo = 0; // 连击中断
      this.onFeedback({ type: 'miss', index: clickedIndex });

      this.gridCells = this.gridCells.map((cell, idx) => ({
        ...cell,
        isWrong: idx === clickedIndex
      }));

      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo
      });
      this.onBoardUpdate({
        gridCells: this.gridCells,
        activeIndex: this.activeIndex
      });

      // 200ms 后清除错误标记
      if (this._wrongResetTimer) clearTimeout(this._wrongResetTimer);
      this._wrongResetTimer = setTimeout(() => {
        if (this.gameState === 'playing') {
          this.gridCells = this.gridCells.map(c => ({ ...c, isWrong: false }));
          this.onBoardUpdate({
            gridCells: this.gridCells,
            activeIndex: this.activeIndex
          });
        }
      }, 200);
    }
  }

  /**
   * 结束游戏
   */
  end() {
    if (this.gameState === 'ended') return;
    this.clearAllTimers();
    this.gameState = 'ended';
    this.onStateChange({ gameState: this.gameState });
    this.onGameOver({
      score: this.score,
      maxCombo: this.maxCombo
    });
  }

  /**
   * 清理所有定时器
   */
  clearAllTimers() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._wrongResetTimer) {
      clearTimeout(this._wrongResetTimer);
      this._wrongResetTimer = null;
    }
  }

  /**
   * 销毁引擎实例
   */
  destroy() {
    this.clearAllTimers();
  }
}

module.exports = ReactionEngine;
