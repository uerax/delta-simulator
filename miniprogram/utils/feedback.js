/**
 * 纯离线单机触感与交互反馈工具 (Feedback Manager)
 * 严格遵循 CLAUDE.md 规范：
 * 1. 读取用户震动设置配置 (settings.vibrationEnabled)
 * 2. 自动识别微信开发者工具开发环境 (platform === 'devtools')，自动跳过硬件马达调用，
 *    彻底消除模拟器因缺少物理马达产生的 IPC 阻塞与页面切页延迟。
 */

let _isDevTools = null;

function checkIsDevTools() {
  if (_isDevTools === null) {
    try {
      if (typeof wx !== 'undefined') {
        if (typeof wx.getAppBaseInfo === 'function') {
          _isDevTools = (wx.getAppBaseInfo().platform === 'devtools');
        } else if (typeof wx.getDeviceInfo === 'function') {
          _isDevTools = (wx.getDeviceInfo().platform === 'devtools');
        } else if (typeof wx.getSystemInfoSync === 'function') {
          const sys = wx.getSystemInfoSync();
          _isDevTools = (sys.platform === 'devtools');
        } else {
          _isDevTools = false;
        }
      } else {
        _isDevTools = false;
      }
    } catch (e) {
      _isDevTools = false;
    }
  }
  return _isDevTools;
}

const Feedback = {
  /**
   * 触发短触感震动
   * @param {boolean} [enabled=true] 是否开启了震动配置 (未传则自动读取 storage)
   * @param {'light' | 'medium' | 'heavy'} [type='light'] 触感轻重
   */
  vibrateShort(enabled, type = 'light') {
    const isEnabled = this._resolveEnabled(enabled);
    if (!isEnabled || checkIsDevTools()) return;
    try {
      wx.vibrateShort({ type });
    } catch (e) {
      // 容错兜底
    }
  },

  /**
   * 触发长震动
   * @param {boolean} [enabled=true] 是否开启了震动配置 (未传则自动读取 storage)
   */
  vibrateLong(enabled) {
    const isEnabled = this._resolveEnabled(enabled);
    if (!isEnabled || checkIsDevTools()) return;
    try {
      wx.vibrateLong();
    } catch (e) {
      // 容错兜底
    }
  },

  /**
   * 便捷轻触感震动
   * @param {boolean} [enabled] 可选
   */
  light(enabled) {
    this.vibrateShort(enabled, 'light');
  },

  /**
   * 便捷中度触感震动
   * @param {boolean} [enabled] 可选
   */
  medium(enabled) {
    this.vibrateShort(enabled, 'medium');
  },

  /**
   * 便捷重度触感震动
   * @param {boolean} [enabled] 可选
   */
  heavy(enabled) {
    this.vibrateShort(enabled, 'heavy');
  },

  /**
   * 冲击轻震动别名 (与部分页面调用兼容)
   */
  impactLight(enabled) {
    this.vibrateShort(enabled, 'light');
  },

  /**
   * 冲击中震动别名
   */
  impactMedium(enabled) {
    this.vibrateShort(enabled, 'medium');
  },

  /**
   * 冲击重震动别名
   */
  impactHeavy(enabled) {
    this.vibrateShort(enabled, 'heavy');
  },

  /**
   * 内部解析是否开启震动
   * @private
   */
  _resolveEnabled(enabled) {
    if (typeof enabled === 'boolean') return enabled;
    try {
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const settings = wx.getStorageSync('delta_settings') || {};
        return settings.vibrationEnabled !== false;
      }
    } catch (e) {
      // ignore
    }
    return true;
  },

  /**
   * 仅供测试与环境检测
   */
  isDevTools() {
    return checkIsDevTools();
  }
};

module.exports = Feedback;
