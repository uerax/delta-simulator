// pages/schulte/index.js
const Storage = require('../../utils/storage');
const Feedback = require('../../utils/feedback');
const SchulteEngine = require('../../games/schulte/engine');

Page({
  data: {
    gameState: 'ready', // 'ready' | 'playing' | 'ended'
    gridNumbers: Array.from({ length: 16 }, (_, i) => ({ num: i + 1, cleared: false, isWrong: false })),
    currentTarget: 1,
    timeStr: '0.0',
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
      this._engine.clearAllTimers();
    }
  },

  initEngine() {
    this._engine = new SchulteEngine({
      totalNumbers: 16,
      autoInitSilent: true, // 静默构造，由 onLoad 统一批处理 setData
      onStateChange: ({ gameState }) => {
        this.setData({ gameState });
      },
      onTick: ({ timeStr }) => {
        this.setData({ timeStr });
      },
      onGridUpdate: ({ gridNumbers, currentTarget }) => {
        this.setData({ gridNumbers, currentTarget });
      },
      onFeedback: ({ type }) => {
        const enabled = Boolean(this._settings && this._settings.vibrationEnabled);
        if (type === 'hit') {
          Feedback.vibrateShort(enabled, 'light');
        } else {
          Feedback.vibrateLong(enabled);
        }
      },
      onGameOver: ({ finalSeconds, timeStr, rating }) => {
        this.handleGameOver(finalSeconds, timeStr, rating);
      }
    });
  },

  startGame() {
    this.setData({ showResultModal: false });
    if (this._engine) {
      this._engine.start();
    }
  },

  onBoxTap(e) {
    if (!this._engine || this.data.gameState !== 'playing') return;
    const index = e.currentTarget.dataset.index;
    this._engine.handleBoxTap(index);
  },

  handleGameOver(finalSeconds, timeStr, rating) {
    const res = Storage.recordSchulteResult(finalSeconds);
    const isNewRecord = res ? res.isNewRecord : false;
    const stats = res ? res.stats : Storage.getGameStats();
    const bestRecord = stats.schulteBestTime ? stats.schulteBestTime.toFixed(1) : finalSeconds.toFixed(1);

    const resultItems = [
      { label: '最终用时', value: `${timeStr} 秒`, highlight: true, highlightColor: '#89b4fa' },
      { label: '专注力评级', value: rating, highlight: true, highlightColor: '#a6e3a1' },
      { label: '历史最佳用时', value: `${bestRecord} 秒` }
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
