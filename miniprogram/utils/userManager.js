/**
 * 独立用户管理服务模块 (User Manager Service)
 * 封装微信登录生命周期、状态机、单机凭证与用户资料观察者
 */

const Storage = require('./storage');

// 登录状态机枚举
const LOGIN_STATUS = {
  UNLOGIN: 'unlogin',         // 未登录 / 游客态
  LOGGING_IN: 'logging_in',   // 正在登录中
  LOGGED_IN: 'logged_in',     // 已完成登录
  LOGIN_FAILED: 'login_failed' // 登录失败
};

class UserManagerService {
  constructor() {
    this.LOGIN_STATUS = LOGIN_STATUS;
    this._status = LOGIN_STATUS.UNLOGIN;
    this._userInfo = null;
    this._listeners = new Set();
    this._loginPromise = null;
    this._initialized = false;
  }

  /**
   * 初始化用户模块
   * 在 app.onLaunch 或页面加载首帧执行
   * @returns {Object} 当前用户信息
   */
  init() {
    if (this._initialized) {
      return this.getUserInfo();
    }

    try {
      const profile = Storage.getUserProfile();
      this._userInfo = {
        userId: profile.userId || Storage.getOrCreateUserId(),
        nickName: profile.nickName || '野生鼠鼠',
        avatarUrl: profile.avatarUrl || '/images/avatar.png',
        isLoggedIn: Boolean(profile.isLoggedIn),
        loginTime: profile.loginTime || null,
        loginType: profile.loginType || (profile.isLoggedIn ? 'wechat' : 'guest')
      };

      if (this._userInfo.isLoggedIn) {
        this._status = LOGIN_STATUS.LOGGED_IN;
      } else {
        this._status = LOGIN_STATUS.UNLOGIN;
      }

      this._initialized = true;
      return this.getUserInfo();
    } catch (e) {
      console.error('[UserManager] 初始化失败:', e);
      this._userInfo = {
        userId: 'usr_guest',
        nickName: '野生鼠鼠',
        avatarUrl: '/images/avatar.png',
        isLoggedIn: false,
        loginTime: null,
        loginType: 'guest'
      };
      this._status = LOGIN_STATUS.UNLOGIN;
      this._initialized = true;
      return this.getUserInfo();
    }
  }

  /**
   * 获取当前用户信息（安全只读副本）
   * @returns {Object}
   */
  getUserInfo() {
    if (!this._initialized) {
      this.init();
    }
    return { ...this._userInfo };
  }

  /**
   * 当前是否处于已登录状态
   * @returns {boolean}
   */
  isLoggedIn() {
    return Boolean(this._userInfo && this._userInfo.isLoggedIn);
  }

  /**
   * 获取当前登录状态枚举值
   * @returns {string}
   */
  getStatus() {
    return this._status;
  }

  /**
   * 微信用户登录主流程
   * 包装 wx.login，自动处理单机凭证与持久化，带并发防抖锁
   * @param {Object} options
   * @param {boolean} options.silent 是否静默登录（不弹 Toast）
   * @returns {Promise<Object>} 用户信息
   */
  login(options = {}) {
    const { silent = false } = options;

    // 并发防重锁：若正在登录中，直接返回既有登录中的 Promise
    if (this._loginPromise) {
      return this._loginPromise;
    }

    this._status = LOGIN_STATUS.LOGGING_IN;
    this._notify('statusChange', { status: this._status });

    this._loginPromise = new Promise((resolve, reject) => {
      // 1. 微信客户端环境：调用原生 wx.login 获取临时凭证
      if (typeof wx !== 'undefined' && typeof wx.login === 'function') {
        wx.login({
          timeout: 8000,
          success: (res) => {
            if (res.code) {
              const userId = Storage.getOrCreateUserId();
              const updated = Storage.setUserProfile({
                userId,
                isLoggedIn: true,
                loginTime: Date.now(),
                loginType: 'wechat',
                lastCode: res.code
              });

              this._userInfo = { ...this._userInfo, ...updated, isLoggedIn: true };
              this._status = LOGIN_STATUS.LOGGED_IN;

              if (!silent && typeof wx.showToast === 'function') {
                wx.showToast({
                  title: '微信登录成功',
                  icon: 'success',
                  duration: 1500
                });
              }

              this._notify('login', this.getUserInfo());
              resolve(this.getUserInfo());
            } else {
              this._handleLoginFail('获取登录凭证失败: ' + (res.errMsg || '未知原因'), silent, resolve);
            }
          },
          fail: (err) => {
            // 离线/模拟器降级策略：即便网络断开或单机无网，依然完成单机登录闭环
            console.warn('[UserManager] wx.login 失败，降级为单机离线登录:', err);
            const userId = Storage.getOrCreateUserId();
            const updated = Storage.setUserProfile({
              userId,
              isLoggedIn: true,
              loginTime: Date.now(),
              loginType: 'offline'
            });

            this._userInfo = { ...this._userInfo, ...updated, isLoggedIn: true };
            this._status = LOGIN_STATUS.LOGGED_IN;

            if (!silent && typeof wx.showToast === 'function') {
              wx.showToast({
                title: '单机就绪',
                icon: 'success',
                duration: 1500
              });
            }

            this._notify('login', this.getUserInfo());
            resolve(this.getUserInfo());
          },
          complete: () => {
            this._loginPromise = null;
          }
        });
      } else {
        // 2. Node.js 测试环境或非微信环境降级
        const userId = Storage.getOrCreateUserId();
        const updated = Storage.setUserProfile({
          userId,
          isLoggedIn: true,
          loginTime: Date.now(),
          loginType: 'mock'
        });

        this._userInfo = { ...this._userInfo, ...updated, isLoggedIn: true };
        this._status = LOGIN_STATUS.LOGGED_IN;
        this._loginPromise = null;

        this._notify('login', this.getUserInfo());
        resolve(this.getUserInfo());
      }
    });

    return this._loginPromise;
  }

  /**
   * 处理登录失败回退
   * @private
   */
  _handleLoginFail(reason, silent, resolve) {
    this._status = LOGIN_STATUS.LOGIN_FAILED;
    this._loginPromise = null;

    // 容错降级：依然保持单机账号可用性
    const userId = Storage.getOrCreateUserId();
    const updated = Storage.setUserProfile({
      userId,
      isLoggedIn: true,
      loginTime: Date.now(),
      loginType: 'guest_fallback'
    });

    this._userInfo = { ...this._userInfo, ...updated, isLoggedIn: true };
    this._status = LOGIN_STATUS.LOGGED_IN;

    if (!silent && typeof wx.showToast === 'function') {
      wx.showToast({
        title: '已接入单机模式',
        icon: 'none',
        duration: 1500
      });
    }

    this._notify('login', this.getUserInfo());
    resolve(this.getUserInfo());
  }

  /**
   * 检查微信会话状态 (wx.checkSession)
   * @returns {Promise<boolean>}
   */
  checkSession() {
    return new Promise((resolve) => {
      if (typeof wx !== 'undefined' && typeof wx.checkSession === 'function') {
        wx.checkSession({
          success: () => {
            resolve(true);
          },
          fail: () => {
            console.log('[UserManager] 微信会话已过期，需要静默刷新');
            resolve(false);
          }
        });
      } else {
        resolve(true);
      }
    });
  }

  /**
   * 更新用户个人资料（头像/昵称）
   * @param {Object} partialProfile
   * @param {string} [partialProfile.nickName]
   * @param {string} [partialProfile.avatarUrl]
   * @returns {Object} 更新后的用户信息
   */
  updateProfile(partialProfile = {}) {
    if (!this._initialized) {
      this.init();
    }

    const payload = {};
    if (typeof partialProfile.nickName === 'string') {
      const trimmed = partialProfile.nickName.trim();
      if (trimmed) {
        payload.nickName = trimmed;
      }
    }
    if (typeof partialProfile.avatarUrl === 'string' && partialProfile.avatarUrl) {
      payload.avatarUrl = partialProfile.avatarUrl;
    }

    if (Object.keys(payload).length === 0) {
      return this.getUserInfo();
    }

    const updated = Storage.setUserProfile(payload);
    this._userInfo = { ...this._userInfo, ...updated };
    this._notify('update', this.getUserInfo());
    return this.getUserInfo();
  }

  /**
   * 退出登录（切换为离线游客身份）
   * @returns {Object}
   */
  logout() {
    if (!this._initialized) {
      this.init();
    }

    const updated = Storage.setUserProfile({
      isLoggedIn: false,
      loginTime: null,
      loginType: 'guest'
    });

    this._userInfo = { ...this._userInfo, ...updated, isLoggedIn: false };
    this._status = LOGIN_STATUS.UNLOGIN;

    this._notify('logout', this.getUserInfo());
    return this.getUserInfo();
  }

  /**
   * 订阅用户模块事件
   * @param {string} event 'login' | 'logout' | 'update' | 'statusChange' | 'change'
   * @param {Function} listener 回调函数
   */
  on(event, listener) {
    if (typeof listener !== 'function') return;
    this._listeners.add({ event, listener });
  }

  /**
   * 注销用户模块事件监听
   * @param {string} event
   * @param {Function} listener
   */
  off(event, listener) {
    if (!event && !listener) {
      this._listeners.clear();
      return;
    }
    for (const item of this._listeners) {
      if (item.event === event && (!listener || item.listener === listener)) {
        this._listeners.delete(item);
      }
    }
  }

  /**
   * 广播通知监听者
   * @private
   */
  _notify(event, data) {
    for (const item of this._listeners) {
      if (item.event === event || item.event === 'change') {
        try {
          item.listener(data, event);
        } catch (e) {
          console.error(`[UserManager] 监听回调执行异常 [${event}]:`, e);
        }
      }
    }
  }
}

// 单例导出
module.exports = new UserManagerService();
