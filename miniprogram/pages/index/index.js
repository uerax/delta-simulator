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
    gameList: getInitialGameList(),
    showLoginModal: false,
    isLoggingIn: false
  },

  _isNavigating: false,
  _onUserChange: null,
  _hasPromptedLogin: false,

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

    // 首屏冷启动检测：若未登录则主动弹出登录提醒弹窗 (单次 session 仅主动提醒一次，不骚扰用户)
    if (!this._hasPromptedLogin) {
      this._hasPromptedLogin = true;
      const userProfile = UserManager.getUserInfo();
      if (!userProfile || !userProfile.isLoggedIn) {
        setTimeout(() => {
          if (!this.data.userProfile.isLoggedIn) {
            this.setData({ showLoginModal: true });
          }
        }, 350);
      }
    }
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

  // 阻止蒙层触摸穿透
  preventTouchMove() {
    return false;
  },

  // 唤起特勤身份登录认证弹窗
  onOpenLoginModal() {
    if (this.data.settings && this.data.settings.vibrationEnabled) {
      Feedback.vibrateShort(true, 'light');
    }
    this.setData({ showLoginModal: true });
  },

  // 关闭特勤登录认证弹窗
  onCloseLoginModal() {
    if (this.data.settings && this.data.settings.vibrationEnabled) {
      Feedback.vibrateShort(true, 'light');
    }
    this.setData({ showLoginModal: false });
  },

  // 弹窗中确认微信一键登录并激活通行证
  onConfirmModalLogin() {
    if (this.data.isLoggingIn) return;

    if (this.data.settings && this.data.settings.vibrationEnabled) {
      Feedback.vibrateShort(true, 'light');
    }

    this.setData({ isLoggingIn: true });

    UserManager.login()
      .then((userInfo) => {
        this.setData({
          userProfile: userInfo,
          showLoginModal: false,
          isLoggingIn: false
        });
        if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
          wx.showToast({
            title: '特勤身份已激活',
            icon: 'success',
            duration: 1500
          });
        }
      })
      .catch((err) => {
        this.setData({ isLoggingIn: false });
        console.error('登录激活失败:', err);
      });
  },

  // 微信一键登录 (兼容保留)
  onWechatLogin() {
    this.onOpenLoginModal();
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
      if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
        wx.showToast({
          title: '头像已更新',
          icon: 'success',
          duration: 1200
        });
      }
    }
  },

  // 昵称输入捕获 (支持微信键盘一键快捷填充)
  onNicknameInput(e) {
    const nickName = (e.detail && e.detail.value) ? e.detail.value.trim() : '';
    if (nickName) {
      const updated = UserManager.updateProfile({ nickName });
      this.setData({ userProfile: updated });
    }
  },

  // 昵称修改失焦确认
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
