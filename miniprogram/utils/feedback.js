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
      if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
        const sys = wx.getSystemInfoSync();
        _isDevTools = (sys.platform === 'devtools');
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
   * @param {boolean} enabled 是否开启了震动配置
   * @param {'light' | 'medium' | 'heavy'} type 触感轻重
   */
  vibrateShort(enabled = true, type = 'light') {
    if (!enabled || checkIsDevTools()) return;
    try {
      wx.vibrateShort({ type });
    } catch (e) {
      // 容错兜底
    }
  },

  /**
   * 触发长震动
   * @param {boolean} enabled 是否开启了震动配置
   */
  vibrateLong(enabled = true) {
    if (!enabled || checkIsDevTools()) return;
    try {
      wx.vibrateLong();
    } catch (e) {
      // 容错兜底
    }
  },

  /**
   * 仅供测试与环境检测
   */
  isDevTools() {
    return checkIsDevTools();
  }
};

module.exports = Feedback;
