// pages/index/index.js
const Storage = require('../../utils/storage');
const Feedback = require('../../utils/feedback');
const GameRegistry = require('../../games/registry');

// 获取初始游戏卡片列表（声明期即刻绑定最新游戏元数据与战绩适配）
function getInitialGameList() {
  try {
    const stats = Storage.getGameStats ? Storage.getGameStats() : {};
    const recordsMap = (typeof wx !== 'undefined' && wx.getStorageSync)
      ? (wx.getStorageSync(Storage.STORAGE_KEYS.GAME_RECORDS) || {})
      : {};
    return GameRegistry.getLobbyList(stats, recordsMap);
  } catch (e) {
    return GameRegistry.getLobbyList();
  }
}

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
    gameList: getInitialGameList()
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

  // 卡片点击触感反馈 (异步延后触发，0ms 不阻塞原生路由派发)
  onCardTap() {
    if (this.data.settings && this.data.settings.vibrationEnabled) {
      setTimeout(() => {
        Feedback.vibrateShort(true, 'light');
      }, 0);
    }
  },

  // 选择游戏进入（编程式跳转兜底）
  onSelectGame(e) {
    if (this._isNavigating) return;
    const path = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.path) || (typeof e === 'string' ? e : '');
    if (!path) return;

    this._isNavigating = true;
    // 立即发起跳转，绝不在 navigateTo 之前插入任何同步阻塞或系统硬件调用
    wx.navigateTo({
      url: path,
      complete: () => {
        setTimeout(() => {
          this._isNavigating = false;
        }, 200);
      }
    });

    // 触感反馈异步触发
    if (this.data.settings && this.data.settings.vibrationEnabled) {
      setTimeout(() => {
        Feedback.vibrateShort(true, 'light');
      }, 0);
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
