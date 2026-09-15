/**
 * 纯离线单机数据存储管理模块 (Storage Manager)
 * 封装微信本地存储 wx.setStorageSync / wx.getStorageSync
 */

const STORAGE_KEYS = {
  USER_PROFILE: 'delta_user_profile',
  GAME_STATS: 'delta_game_stats',
  DAILY_RECORDS: 'delta_daily_records',
  SETTINGS: 'delta_settings'
};

// 获取今天的日期字符串 YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const Storage = {
  /**
   * 获取玩家信息
   */
  getUserProfile() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE);
      return data || {
        nickName: '无名勇士',
        avatarUrl: '/images/avatar.png'
      };
    } catch (e) {
      console.error('读取用户配置失败:', e);
      return { nickName: '玩家', avatarUrl: '/images/avatar.png' };
    }
  },

  /**
   * 保存玩家信息
   */
  setUserProfile(profile) {
    try {
      const current = this.getUserProfile();
      const updated = { ...current, ...profile };
      wx.setStorageSync(STORAGE_KEYS.USER_PROFILE, updated);
      return updated;
    } catch (e) {
      console.error('保存用户配置失败:', e);
      return null;
    }
  },

  /**
   * 获取全局战绩统计
   */
  getGameStats() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.GAME_STATS);
      return data || {
        highScore: 0,         // 极速反应挑战最高分
        schulteBestTime: 0,   // 舒尔特方格最佳成绩(秒，越小越好)
        totalGames: 0,        // 总游玩局数
        bestCombo: 0,         // 反应力最高连击
        coins: 0              // 累计积分/金币
      };
    } catch (e) {
      console.error('读取游戏统计失败:', e);
      return { highScore: 0, schulteBestTime: 0, totalGames: 0, bestCombo: 0, coins: 0 };
    }
  },

  /**
   * 记录【极速反应挑战】战绩
   */
  recordReactionResult(score, maxCombo = 0) {
    try {
      const stats = this.getGameStats();
      const isNewRecord = score > stats.highScore;
      stats.highScore = Math.max(stats.highScore, score);
      stats.totalGames += 1;
      stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
      stats.coins += Math.floor(score / 10);
      wx.setStorageSync(STORAGE_KEYS.GAME_STATS, stats);

      this._incrementDailyPlay(score);

      return { stats, isNewRecord };
    } catch (e) {
      console.error('记录反应力战绩失败:', e);
      return null;
    }
  },

  /**
   * 记录【舒尔特方格】战绩
   * @param {number} timeUsed 用时(秒)
   */
  recordSchulteResult(timeUsed) {
    try {
      const stats = this.getGameStats();
      const isNewRecord = stats.schulteBestTime === 0 || timeUsed < stats.schulteBestTime;
      if (isNewRecord) {
        stats.schulteBestTime = timeUsed;
      }
      stats.totalGames += 1;
      stats.coins += 15;
      wx.setStorageSync(STORAGE_KEYS.GAME_STATS, stats);

      this._incrementDailyPlay(10);

      return { stats, isNewRecord };
    } catch (e) {
      console.error('记录舒尔特战绩失败:', e);
      return null;
    }
  },

  // 内部辅助：更新今日战报
  _incrementDailyPlay(addScore = 0) {
    const today = getTodayString();
    const dailyMap = wx.getStorageSync(STORAGE_KEYS.DAILY_RECORDS) || {};
    const todayData = dailyMap[today] || { plays: 0, totalScore: 0 };
    todayData.plays += 1;
    todayData.totalScore += addScore;
    dailyMap[today] = todayData;
    wx.setStorageSync(STORAGE_KEYS.DAILY_RECORDS, dailyMap);
  },

  /**
   * 获取今日战报
   */
  getTodayRecord() {
    try {
      const today = getTodayString();
      const dailyMap = wx.getStorageSync(STORAGE_KEYS.DAILY_RECORDS) || {};
      return dailyMap[today] || { plays: 0, totalScore: 0 };
    } catch (e) {
      return { plays: 0, totalScore: 0 };
    }
  },

  /**
   * 获取系统设置
   */
  getSettings() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.SETTINGS);
      return data || {
        soundEnabled: true,
        vibrationEnabled: true
      };
    } catch (e) {
      return { soundEnabled: true, vibrationEnabled: true };
    }
  },

  /**
   * 保存系统设置
   */
  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      wx.setStorageSync(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    } catch (e) {
      console.error('保存设置失败:', e);
      return null;
    }
  },

  /**
   * 清空所有本地数据（用于调试与数据重置）
   */
  clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach(k => wx.removeStorageSync(k));
      return true;
    } catch (e) {
      console.error('清空数据失败:', e);
      return false;
    }
  }
};

module.exports = Storage;
