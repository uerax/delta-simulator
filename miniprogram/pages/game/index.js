// pages/game/index.js
const Storage = require('../../utils/storage');

Page({
  data: {
    gameState: 'ready', // 'ready' | 'playing' | 'ended'
    timeLeft: 30,
    score: 0,
    combo: 0,
    maxCombo: 0,
    gridCells: [],
    showResultModal: false,
    gameResult: null
  },

  // 内部非响应式状态（性能优化：不需要参与 WXML 渲染的属性不放入 data）
  _timer: null,
  _activeIndex: -1,
  _settings: null,

  onLoad() {
    this.initBoard();
    this._settings = Storage.getSettings();
  },

  onUnload() {
    this.clearGameTimer();
  },

  onHide() {
    if (this.data.gameState === 'playing') {
      this.endGame();
    }
  },

  initBoard() {
    const cells = Array.from({ length: 9 }, () => ({
      isActive: false,
      isWrong: false
    }));
    this.setData({
      gridCells: cells,
      timeLeft: 30,
      score: 0,
      combo: 0,
      maxCombo: 0,
      gameState: 'ready',
      showResultModal: false
    });
    this._activeIndex = -1;
  },

  startGame() {
    this.initBoard();
    this.setData({ gameState: 'playing' });
    this.spawnTarget();

    // 倒计时
    this._timer = setInterval(() => {
      const nextTime = this.data.timeLeft - 1;
      if (nextTime <= 0) {
        this.setData({ timeLeft: 0 });
        this.endGame();
      } else {
        this.setData({ timeLeft: nextTime });
      }
    }, 1000);
  },

  clearGameTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  spawnTarget() {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * 9);
    } while (nextIndex === this._activeIndex);

    this._activeIndex = nextIndex;
    const cells = this.data.gridCells.map((cell, idx) => ({
      isActive: idx === nextIndex,
      isWrong: false
    }));
    this.setData({ gridCells: cells });
  },

  onCellTap(e) {
    if (this.data.gameState !== 'playing') return;

    const clickedIndex = e.currentTarget.dataset.index;

    if (clickedIndex === this._activeIndex) {
      // 点击正确
      const newCombo = this.data.combo + 1;
      const addScore = 10 + Math.floor(newCombo / 3) * 5; // 连击得分加成
      const newScore = this.data.score + addScore;
      const newMaxCombo = Math.max(this.data.maxCombo, newCombo);

      // 触感震动反馈
      if (this._settings.vibrationEnabled) {
        wx.vibrateShort({ type: 'light' });
      }

      this.setData({
        score: newScore,
        combo: newCombo,
        maxCombo: newMaxCombo
      });

      this.spawnTarget();
    } else {
      // 点击错误
      if (this._settings.vibrationEnabled) {
        wx.vibrateLong();
      }

      // 闪烁错误标记
      const cells = this.data.gridCells.map((cell, idx) => ({
        ...cell,
        isWrong: idx === clickedIndex
      }));

      this.setData({
        gridCells: cells,
        combo: 0 // 连击中断
      });

      setTimeout(() => {
        if (this.data.gameState === 'playing') {
          const resetCells = this.data.gridCells.map(c => ({ ...c, isWrong: false }));
          this.setData({ gridCells: resetCells });
        }
      }, 200);
    }
  },

  endGame() {
    this.clearGameTimer();

    // 持久化存储本局战绩到 Storage
    const result = Storage.recordReactionResult(this.data.score, this.data.maxCombo);

    this.setData({
      gameState: 'ended',
      showResultModal: true,
      gameResult: result
    });
  },

  restartGame() {
    this.startGame();
  },

  goHome() {
    wx.navigateBack();
  }
});
