// pages/index/index.js
const Storage = require('../../utils/storage');
const Feedback = require('../../utils/feedback');
const GameRegistry = require('../../games/registry');

Page({
  data: {
    userProfile: {
      nickName: '',
      avatarUrl: '/images/avatar.png'
    },
    todayRecord: {
      plays: 0,
      totalScore: 0
    },
    gameStats: {
      highScore: 0,
      schulteBestTime: 0,
      totalGames: 0,
      coins: 0
    },
    settings: {
      soundEnabled: true,
      vibrationEnabled: true
    },
    gameList: []
  },

  _isNavigating: false,

  onLoad() {
    this.refreshAllData();
  },

  onShow() {
    // 切回大厅时刷新最新战绩与金币，并释放跳转防重锁
    this._isNavigating = false;
    this.refreshAllData();
  },

  refreshAllData() {
    const userProfile = Storage.getUserProfile();
    const todayRecord = Storage.getTodayRecord();
    const gameStats = Storage.getGameStats();
    const settings = Storage.getSettings();
    const recordsMap = wx.getStorageSync(Storage.STORAGE_KEYS.GAME_RECORDS) || {};

    // 通过游戏注册中心统一生成大厅列表（配置驱动，与具体游戏解耦）
    const gameList = GameRegistry.getLobbyList(gameStats, recordsMap);

    this.setData({
      userProfile,
      todayRecord,
      gameStats,
      settings,
      gameList
    });
  },

  // 选择游戏进入（增加防重节流锁与环境自适应反馈）
  onSelectGame(e) {
    if (this._isNavigating) return;
    const { path } = e.currentTarget.dataset;
    if (path) {
      this._isNavigating = true;
      Feedback.vibrateShort(this.data.settings.vibrationEnabled, 'light');
      wx.navigateTo({
        url: path,
        complete: () => {
          setTimeout(() => {
            this._isNavigating = false;
          }, 300);
        }
      });
    }
  },

  // 头像选择
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      const updated = Storage.setUserProfile({ avatarUrl });
      this.setData({ userProfile: updated });
    }
  },

  // 昵称修改
  onNicknameBlur(e) {
    const nickName = e.detail.value.trim();
    if (nickName) {
      const updated = Storage.setUserProfile({ nickName });
      this.setData({ userProfile: updated });
    }
  },

  // 开关震动
  onToggleVibration(e) {
    const vibrationEnabled = e.detail.value;
    const updated = Storage.saveSettings({ vibrationEnabled });
    this.setData({ settings: updated });
    Feedback.vibrateShort(vibrationEnabled, 'light');
  },

  // 开关音效
  onToggleSound(e) {
    const soundEnabled = e.detail.value;
    const updated = Storage.saveSettings({ soundEnabled });
    this.setData({ settings: updated });
  },

  // 重置数据
  confirmResetData() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有本地战绩吗？',
      confirmColor: '#f38ba8',
      success: (res) => {
        if (res.confirm) {
          Storage.clearAll();
          this.refreshAllData();
          wx.showToast({
            title: '已重置本地数据',
            icon: 'success'
          });
        }
      }
    });
  }
});
