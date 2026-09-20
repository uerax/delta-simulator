/**
 * 纯离线背景音乐管理器 (BgmManager)
 * 严格遵循 CLAUDE.md 规范：
 * 1. 大厅保持安静，背景音乐默认关闭（需用户在设置中开启后才作用在进入游戏后）；
 * 2. 音量统一为 20% (TARGET_VOLUME = 0.2)，防重复播放守卫，杜绝切页打断；
 * 3. 严格遵循用户配置 (settings.musicEnabled)，退出游戏/返回大厅时即时停止，杜绝漏音与内存泄漏。
 */

const Storage = require('@/utils/storage');

const BGM_PATH = '/assets/audio/bgm.m4a';
const TARGET_VOLUME = 0.2; // 目标音量 20%

class BgmManager {
  constructor() {
    this._audioCtx = null;
    this._isPlaying = false;
  }

  /**
   * 初始化单例 InnerAudioContext 实例
   */
  _getAudioContext() {
    if (this._audioCtx) return this._audioCtx;
    if (typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') {
      return null;
    }

    try {
      if (typeof wx.setInnerAudioOption === 'function') {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false, // 保证 iOS 开启静音开关时也能听到背景音乐
          mixWithOther: true
        });
      }
    } catch (e) {}

    const ctx = wx.createInnerAudioContext();
    ctx.src = BGM_PATH;
    ctx.loop = true;
    ctx.volume = TARGET_VOLUME;

    ctx.onError((err) => {
      console.warn('[BgmManager] 背景音乐播放异常:', err);
      this._isPlaying = false;
    });

    ctx.onPlay(() => {
      this._isPlaying = true;
    });

    ctx.onPause(() => {
      this._isPlaying = false;
    });

    ctx.onStop(() => {
      this._isPlaying = false;
    });

    this._audioCtx = ctx;
    return ctx;
  }

  /**
   * 点击进入游戏后播放背景音乐 (含防重入守卫，避免转场多次调用打断)
   */
  play() {
    const settings = Storage.getSettings();
    if (settings && settings.musicEnabled === false) {
      return;
    }

    const ctx = this._getAudioContext();
    if (!ctx) return;

    // 若已在播放中，直接复用，杜绝多次触发打断音频
    if (this._isPlaying) {
      return;
    }

    this._isPlaying = true;
    ctx.volume = TARGET_VOLUME;
    ctx.play();
  }

  /**
   * 暂停背景音乐
   */
  pause() {
    this._isPlaying = false;
    if (this._audioCtx) {
      try {
        this._audioCtx.pause();
      } catch (e) {}
    }
  }

  /**
   * 返回大厅时完全停止背景音乐
   */
  stop() {
    this._isPlaying = false;
    if (this._audioCtx) {
      try {
        this._audioCtx.stop();
      } catch (e) {}
    }
  }

  /**
   * 大厅开关切换通知
   */
  onToggle(enabled) {
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * 彻底销毁音频实例
   */
  destroy() {
    this._isPlaying = false;
    if (this._audioCtx) {
      try {
        this._audioCtx.stop();
        this._audioCtx.destroy();
      } catch (e) {}
      this._audioCtx = null;
    }
  }
}

module.exports = new BgmManager();
