// pages/index/index.js
const Storage = require('../../utils/storage');
const Feedback = require('../../utils/feedback');
const GameRegistry = require('../../games/registry');
const UserManager = require('../../utils/userManager');

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
      nickName: '野生鼠鼠',
      avatarUrl: '/images/avatar.png',
      isLoggedIn: false
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
  _onUserChange: null,

  onLoad() {
    // 监听全局用户状态与资料更新
    this._onUserChange = (userInfo) => {
      if (userInfo) {
        this.setData({ userProfile: userInfo });
      }
    };
    UserManager.on('change', this._onUserChange);
    this.refreshAllData();
  },

  onUnload() {
    // 页面卸载时注销用户监听器，防止内存泄漏
    if (this._onUserChange) {
      UserManager.off('change', this._onUserChange);
      this._onUserChange = null;
    }
  },

  onShow() {
    // 切回大厅时刷新最新战绩与金币，并释放跳转防重锁
    this._isNavigating = false;
    // 静默校验微信会话
    UserManager.checkSession();
    this.refreshAllData();
  },

  refreshAllData() {
    const userProfile = UserManager.getUserInfo();
    const todayRecord = Storage.getTodayRecord();
    const gameStats = Storage.getGameStats();
    const settings = Storage.getSettings();
    const recordsMap = (typeof wx !== 'undefined' && wx.getStorageSync)
      ? (wx.getStorageSync(Storage.STORAGE_KEYS.GAME_RECORDS) || {})
      : {};

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

  // 微信一键登录
  onWechatLogin() {
    if (this.data.settings && this.data.settings.vibrationEnabled) {
      Feedback.vibrateShort(true, 'light');
    }

    if (typeof wx !== 'undefined' && typeof wx.showLoading === 'function') {
      wx.showLoading({ title: '正在连接微信...' });
    }

    UserManager.login()
      .then((userInfo) => {
        if (typeof wx !== 'undefined' && typeof wx.hideLoading === 'function') {
          wx.hideLoading();
        }
        this.setData({ userProfile: userInfo });
      })
      .catch((err) => {
        if (typeof wx !== 'undefined' && typeof wx.hideLoading === 'function') {
          wx.hideLoading();
        }
        console.error('登录失败:', err);
      });
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
    const { avatarUrl } = e.detail || {};
    if (avatarUrl) {
      const updated = UserManager.updateProfile({ avatarUrl });
      this.setData({ userProfile: updated });
    }
  },

  // 昵称修改
  onNicknameBlur(e) {
    const nickName = (e.detail && e.detail.value) ? e.detail.value.trim() : '';
    if (nickName) {
      const updated = UserManager.updateProfile({ nickName });
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
  }
});
