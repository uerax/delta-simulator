// pages/index/index.js
const Storage = require('../../utils/storage');
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

  onLoad() {
    this.refreshAllData();
  },

  onShow() {
    // 切回大厅时刷新最新战绩与金币
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

  // 选择游戏进入
  onSelectGame(e) {
    const { path } = e.currentTarget.dataset;
    if (path) {
      if (this.data.settings.vibrationEnabled) {
        wx.vibrateShort({ type: 'light' });
      }
      wx.navigateTo({
        url: path
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
    if (vibrationEnabled) {
      wx.vibrateShort({ type: 'light' });
    }
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
