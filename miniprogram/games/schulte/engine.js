/**
 * 舒尔特专注方格 - 纯 JavaScript 核心逻辑引擎
 * 零依赖微信环境，独立可单测
 */

class SchulteEngine {
  constructor(options = {}) {
    this.totalNumbers = options.totalNumbers || 16; // 默认4x4共16个数字

    // 回调钩子
    this.onTick = options.onTick || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onGridUpdate = options.onGridUpdate || (() => {});
    this.onFeedback = options.onFeedback || (() => {});
    this.onGameOver = options.onGameOver || (() => {});

    // 内部状态
    this.gameState = 'ready'; // 'ready' | 'playing' | 'ended'
    this.gridNumbers = [];
    this.currentTarget = 1;
    this.timeStr = '0.0';
    this.elapsedSeconds = 0;

    this._startTime = 0;
    this._timer = null;
    this._wrongResetTimer = null;

    this.init();
  }

  /**
   * 初始化/洗牌方格
   */
  init() {
    this.clearAllTimers();
    this.gameState = 'ready';
    this.currentTarget = 1;
    this.timeStr = '0.0';
    this.elapsedSeconds = 0;

    // Fisher-Yates 算法洗牌 1 到 N
    const nums = Array.from({ length: this.totalNumbers }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    this.gridNumbers = nums.map(n => ({
      num: n,
      cleared: false,
      isWrong: false
    }));

    this.onStateChange({ gameState: this.gameState });
    this.onTick({ timeStr: this.timeStr, elapsedSeconds: this.elapsedSeconds });
    this.onGridUpdate({
      gridNumbers: this.gridNumbers,
      currentTarget: this.currentTarget,
      remaining: this.totalNumbers - this.currentTarget + 1
    });
  }

  /**
   * 开始计时与游戏
   */
  start() {
    this.init();
    this.gameState = 'playing';
    this.onStateChange({ gameState: this.gameState });
    this._startTime = Date.now();

    // 0.1秒精度计时
    this._timer = setInterval(() => {
      const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
      this.timeStr = elapsed;
      this.elapsedSeconds = parseFloat(elapsed);
      this.onTick({ timeStr: this.timeStr, elapsedSeconds: this.elapsedSeconds });
    }, 100);
  }

  /**
   * 点击方格
   * @param {number} index
   */
  handleBoxTap(index) {
    if (this.gameState !== 'playing') return;

    const clickedItem = this.gridNumbers[index];
    if (!clickedItem || clickedItem.cleared) return;

    if (clickedItem.num === this.currentTarget) {
      // 点击正确
      this.onFeedback({ type: 'hit', index });

      this.gridNumbers = this.gridNumbers.map((item, idx) => {
        if (idx === index) {
          return { ...item, cleared: true };
        }
        return item;
      });

      const nextTarget = this.currentTarget + 1;

      if (nextTarget > this.totalNumbers) {
        // 全部完成通关！
        this.currentTarget = this.totalNumbers;
        this.onGridUpdate({
          gridNumbers: this.gridNumbers,
          currentTarget: this.currentTarget,
          remaining: 0
        });
        this.completeGame();
      } else {
        this.currentTarget = nextTarget;
        this.onGridUpdate({
          gridNumbers: this.gridNumbers,
          currentTarget: this.currentTarget,
          remaining: this.totalNumbers - this.currentTarget + 1
        });
      }
    } else {
      // 点击错误
      this.onFeedback({ type: 'miss', index });

      this.gridNumbers = this.gridNumbers.map((item, idx) => {
        if (idx === index) {
          return { ...item, isWrong: true };
        }
        return item;
      });

      this.onGridUpdate({
        gridNumbers: this.gridNumbers,
        currentTarget: this.currentTarget,
        remaining: this.totalNumbers - this.currentTarget + 1
      });

      // 200ms 后重置错误红色提示
      if (this._wrongResetTimer) clearTimeout(this._wrongResetTimer);
      this._wrongResetTimer = setTimeout(() => {
        if (this.gameState === 'playing') {
          this.gridNumbers = this.gridNumbers.map(c => ({ ...c, isWrong: false }));
          this.onGridUpdate({
            gridNumbers: this.gridNumbers,
            currentTarget: this.currentTarget,
            remaining: this.totalNumbers - this.currentTarget + 1
          });
        }
      }, 200);
    }
  }

  /**
   * 计算专注力评级
   * @param {number} seconds
   */
  calculateRating(seconds) {
    if (seconds > 25) return '良好';
    if (seconds > 18) return '优秀';
    if (seconds > 12) return '极佳';
    return '王者专注';
  }

  /**
   * 完成通关结算
   */
  completeGame() {
    this.clearAllTimers();
    const finalSeconds = parseFloat(((Date.now() - this._startTime) / 1000).toFixed(1));
    const rating = this.calculateRating(finalSeconds);

    this.gameState = 'ended';
    this.timeStr = finalSeconds.toFixed(1);
    this.elapsedSeconds = finalSeconds;

    this.onStateChange({ gameState: this.gameState });
    this.onTick({ timeStr: this.timeStr, elapsedSeconds: finalSeconds });
    this.onGameOver({
      finalSeconds,
      timeStr: this.timeStr,
      rating
    });
  }

  /**
   * 清理定时器
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

module.exports = SchulteEngine;
