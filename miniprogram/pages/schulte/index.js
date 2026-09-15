// pages/schulte/index.js
const Storage = require('../../utils/storage');

Page({
  data: {
    gameState: 'ready', // 'ready' | 'playing' | 'ended'
    gridNumbers: [],
    currentTarget: 1,
    timeStr: '0.0',
    showResultModal: false,
    isNewRecord: false,
    bestRecord: '0.0',
    rating: '优秀'
  },

  _startTime: 0,
  _timer: null,
  _settings: null,

  onLoad() {
    this._settings = Storage.getSettings();
    this.initGrid();
  },

  onUnload() {
    this.clearTimer();
  },

  onHide() {
    this.clearTimer();
  },

  initGrid() {
    // 生成 1-16 乱序数组
    const nums = Array.from({ length: 16 }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    const grid = nums.map(n => ({
      num: n,
      cleared: false,
      isWrong: false
    }));

    this.setData({
      gridNumbers: grid,
      currentTarget: 1,
      timeStr: '0.0',
      gameState: 'ready',
      showResultModal: false
    });
  },

  startGame() {
    this.initGrid();
    this.setData({ gameState: 'playing' });
    this._startTime = Date.now();

    // 0.1秒精度计时
    this._timer = setInterval(() => {
      const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1);
      this.setData({ timeStr: elapsed });
    }, 100);
  },

  clearTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  onBoxTap(e) {
    if (this.data.gameState !== 'playing') return;

    const index = e.currentTarget.dataset.index;
    const clickedItem = this.data.gridNumbers[index];

    if (clickedItem.cleared) return;

    if (clickedItem.num === this.data.currentTarget) {
      // 点击正确
      if (this._settings.vibrationEnabled) {
        wx.vibrateShort({ type: 'light' });
      }

      const updatedGrid = this.data.gridNumbers.map((item, idx) => {
        if (idx === index) {
          return { ...item, cleared: true };
        }
        return item;
      });

      const nextTarget = this.data.currentTarget + 1;

      if (nextTarget > 16) {
        // 全部找完，通关！
        this.setData({
          gridNumbers: updatedGrid,
          currentTarget: 16
        });
        this.completeGame();
      } else {
        this.setData({
          gridNumbers: updatedGrid,
          currentTarget: nextTarget
        });
      }
    } else {
      // 点击错误
      if (this._settings.vibrationEnabled) {
        wx.vibrateLong();
      }

      const updatedGrid = this.data.gridNumbers.map((item, idx) => {
        if (idx === index) {
          return { ...item, isWrong: true };
        }
        return item;
      });
      this.setData({ gridNumbers: updatedGrid });

      setTimeout(() => {
        if (this.data.gameState === 'playing') {
          const resetGrid = this.data.gridNumbers.map(c => ({ ...c, isWrong: false }));
          this.setData({ gridNumbers: resetGrid });
        }
      }, 200);
    }
  },

  completeGame() {
    this.clearTimer();
    const finalSeconds = parseFloat(((Date.now() - this._startTime) / 1000).toFixed(1));

    // 计算评级
    let rating = '王者专注';
    if (finalSeconds > 25) rating = '良好';
    else if (finalSeconds > 18) rating = '优秀';
    else if (finalSeconds > 12) rating = '极佳';

    // 记录到本地存储
    const res = Storage.recordSchulteResult(finalSeconds);

    this.setData({
      gameState: 'ended',
      timeStr: finalSeconds.toFixed(1),
      showResultModal: true,
      isNewRecord: res ? res.isNewRecord : false,
      bestRecord: res && res.stats.schulteBestTime ? res.stats.schulteBestTime.toFixed(1) : finalSeconds.toFixed(1),
      rating
    });
  },

  restartGame() {
    this.startGame();
  },

  goHome() {
    wx.navigateBack();
  }
});
