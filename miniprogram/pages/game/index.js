// pages/game/index.js
const Storage = require('../../utils/storage');
const Feedback = require('../../utils/feedback');
const ReactionEngine = require('../../games/reaction/engine');

Page({
  data: {
    gameState: 'ready', // 'ready' | 'playing' | 'ended'
    timeLeft: 30,
    score: 0,
    combo: 0,
    maxCombo: 0,
    gridCells: Array.from({ length: 9 }, () => ({ isActive: false, isWrong: false })),
    showResultModal: false,
    isNewRecord: false,
    resultItems: []
  },

  _engine: null,
  _settings: null,

  onLoad() {
    this._settings = Storage.getSettings();
    this.initEngine();
    // 页面加载阶段一次性单批处理初始化渲染，避免模拟器多次连续跨进程通信
    this.setData(this._engine.getInitialState());
  },

  onUnload() {
    if (this._engine) {
      this._engine.destroy();
      this._engine = null;
    }
  },

  onHide() {
    if (this._engine && this.data.gameState === 'playing') {
      this._engine.end();
    }
  },

  initEngine() {
    this._engine = new ReactionEngine({
      totalDuration: 30,
      gridSize: 9,
      autoInitSilent: true, // 静默构造，由 onLoad 统一批处理 setData
      onStateChange: ({ gameState }) => {
        this.setData({ gameState });
      },
      onTick: ({ timeLeft }) => {
        this.setData({ timeLeft });
      },
      onScoreUpdate: ({ score, combo, maxCombo }) => {
        this.setData({ score, combo, maxCombo });
      },
      onBoardUpdate: ({ gridCells }) => {
        this.setData({ gridCells });
      },
      onFeedback: ({ type }) => {
        const enabled = Boolean(this._settings && this._settings.vibrationEnabled);
        if (type === 'hit') {
          Feedback.vibrateShort(enabled, 'light');
        } else {
          Feedback.vibrateLong(enabled);
        }
      },
      onGameOver: ({ score, maxCombo }) => {
        this.handleGameOver(score, maxCombo);
      }
    });
  },

  startGame() {
    this.setData({ showResultModal: false });
    if (this._engine) {
      this._engine.start();
    }
  },

  onCellTap(e) {
    if (!this._engine || this.data.gameState !== 'playing') return;
    const clickedIndex = e.currentTarget.dataset.index;
    this._engine.handleCellTap(clickedIndex);
  },

  handleGameOver(score, maxCombo) {
    const res = Storage.recordReactionResult(score, maxCombo);
    const isNewRecord = res ? res.isNewRecord : false;
    const stats = res ? res.stats : Storage.getGameStats();
    const todayRecord = Storage.getTodayRecord();

    const resultItems = [
      { label: '本局最终得分', value: `${score} 分`, highlight: true, highlightColor: '#fab387' },
      { label: '最高连击数', value: `${maxCombo} 次` },
      { label: '历史最高得分', value: `${stats.highScore || score} 分` },
      { label: '今日已玩局数', value: `${todayRecord.plays || 0} 局` }
    ];

    this.setData({
      showResultModal: true,
      isNewRecord,
      resultItems
    });
  },

  restartGame() {
    this.startGame();
  },

  goHome() {
    wx.navigateBack();
  }
});
