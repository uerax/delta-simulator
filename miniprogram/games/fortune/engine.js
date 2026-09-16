/**
 * 今日鼠鼠运势 - 纯 JS 逻辑引擎 (FortuneEngine)
 *
 * 核心职责:
 *  1. 对接 Storage 持久化层，自动管理每台设备唯一 userId 与日期跨天检测
 *  2. 调度 FortuneAlgorithm 执行确定性抽样 (地图 -> 等级 -> 道具 -> 签文与建议)
 *  3. 提供【免费每日运势】与【付费逆天改命 (Reroll)】双轨接口
 *  4. 具备幂等性保障：同一天同一个用户在不改运的情况下，任何时刻获取结果完全一致
 */

const Storage = require('../../utils/storage');
const { calculateDailyFortune } = require('./fortuneAlgorithm');

class FortuneEngine {
  constructor(options = {}) {
    this.options = options;
    this.gameState = 'ready'; // 'ready' | 'generating' | 'revealed'
    this.currentFortune = null;
    this.rerollCount = 0;
    this.userId = '';
    this.todayDate = '';

    // 回调钩子
    this.onStateChange = options.onStateChange || null;
    this.onFortuneRevealed = options.onFortuneRevealed || null;
  }

  /**
   * 初始化引擎并加载今日运势上下文
   */
  init() {
    this.userId = Storage.getOrCreateUserId();
    this.todayDate = Storage.getTodayString();

    const record = Storage.getFortuneRecord();
    this.rerollCount = record.rerollCount || 0;

    if (record.fortuneResult && record.todayDate === this.todayDate) {
      // 今日已生成过运势，直接恢复状态
      this.currentFortune = record.fortuneResult;
      this._setState('revealed');
    } else {
      // 今日尚未生成
      this.currentFortune = null;
      this._setState('ready');
    }

    return this;
  }

  /**
   * 生成/获取今日运势 (幂等主接口)
   * 若今日已有结果则直接返回，保证同一天内任何重新进入结果完全一致
   * @param {boolean} [forceRefresh=false] 是否强制基于当前 rerollCount 重新计算
   * @returns {Object} 运势完整数据
   */
  getTodayFortune(forceRefresh = false) {
    if (this.currentFortune && !forceRefresh) {
      return this.currentFortune;
    }

    this._setState('generating');

    const result = calculateDailyFortune({
      dateStr: this.todayDate,
      userId: this.userId,
      rerollCount: this.rerollCount,
      isPaid: false
    });

    this.currentFortune = result;
    Storage.saveFortuneRecord(result, this.rerollCount);

    this._setState('revealed');

    if (typeof this.onFortuneRevealed === 'function') {
      this.onFortuneRevealed(result);
    }

    return result;
  }

  /**
   * 付费改运 / 逆天改命 (Reroll)
   * 强行递增改运计数以打破旧随机种子，可选择是否开启强运加权保底
   * @param {Object} [params={}]
   * @param {boolean} [params.isPaid=true] 是否启用付费高阶保底加权
   * @returns {Object} 新的运势数据
   */
  reroll(params = {}) {
    const { isPaid = true } = params;

    this.rerollCount += 1;
    this._setState('generating');

    const newResult = calculateDailyFortune({
      dateStr: this.todayDate,
      userId: this.userId,
      rerollCount: this.rerollCount,
      isPaid
    });

    this.currentFortune = newResult;
    Storage.saveFortuneRecord(newResult, this.rerollCount);

    this._setState('revealed');

    if (typeof this.onFortuneRevealed === 'function') {
      this.onFortuneRevealed(newResult);
    }

    return {
      fortune: newResult,
      rerollCount: this.rerollCount,
      isPaid
    };
  }

  /**
   * 内部状态流转
   * @private
   */
  _setState(state) {
    this.gameState = state;
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(state);
    }
  }

  /**
   * 销毁与资源释放
   */
  destroy() {
    this.currentFortune = null;
    this.onStateChange = null;
    this.onFortuneRevealed = null;
  }
}

module.exports = FortuneEngine;
