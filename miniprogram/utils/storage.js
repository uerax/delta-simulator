/**
 * 纯离线单机数据存储管理模块 (Storage Manager)
 * 封装微信本地存储 wx.setStorageSync / wx.getStorageSync
 */

const STORAGE_KEYS = {
  USER_PROFILE: 'delta_user_profile',
  GAME_STATS: 'delta_game_stats',
  GAME_RECORDS: 'delta_game_records', // [新增] 基于 gameId 的各游戏独立战绩命名空间
  DAILY_RECORDS: 'delta_daily_records',
  SETTINGS: 'delta_settings',
  PRIVILEGES: 'delta_privileges',       // [新增] 付费特权状态命名空间
  LINK_ACTIVE_SESSION: 'delta_link_active_session' // [新增] 鼠鼠连连看未完成对局断点暂存
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
  STORAGE_KEYS,

  getTodayString,

  /**
   * 获取或生成持久化用户 ID
   * 纯离线单机环境下为每台设备生成唯一且不可变的 userId
   * @returns {string} 如 'usr_892104'
   */
  getOrCreateUserId() {
    try {
      const profile = this.getUserProfile();
      if (profile && profile.userId) {
        return profile.userId;
      }
      // 生成格式: usr_<6位随机数字>，简短规整，符合战区特勤UID格式
      const randNum = Math.floor(100000 + Math.random() * 900000);
      const newUserId = 'usr_' + randNum;
      this.setUserProfile({ userId: newUserId });
      return newUserId;
    } catch (e) {
      console.error('获取或创建用户ID失败:', e);
      return 'usr_guest_' + getTodayString().replace(/-/g, '');
    }
  },

  /**
   * 获取玩家信息
   */
  getUserProfile() {
    const defaults = {
      userId: '',
      nickName: '野生鼠鼠',
      avatarUrl: '/images/avatar.png',
      isLoggedIn: false,
      loginTime: null
    };
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE);
      if (!data || typeof data !== 'object') {
        return { ...defaults };
      }
      const profile = { ...defaults, ...data };
      // 历史脏数据强制自愈：若为旧版本默认昵称“无名勇士”或空值，强制重置为“野生鼠鼠”并回写落盘
      if (profile.nickName === '无名勇士' || !profile.nickName) {
        profile.nickName = '野生鼠鼠';
        try {
          wx.setStorageSync(STORAGE_KEYS.USER_PROFILE, profile);
        } catch (err) {}
      }
      return profile;
    } catch (e) {
      console.error('读取用户配置失败:', e);
      return { ...defaults };
    }
  },

  /**
   * 保存玩家信息
   */
  setUserProfile(profile) {
    try {
      const current = this.getUserProfile();
      const updated = { ...current, ...profile };
      // 防御旧默认值“无名勇士”写回
      if (updated.nickName === '无名勇士' || !updated.nickName) {
        updated.nickName = '野生鼠鼠';
      }
      wx.setStorageSync(STORAGE_KEYS.USER_PROFILE, updated);
      return updated;
    } catch (e) {
      console.error('保存用户配置失败:', e);
      return null;
    }
  },

  /**
   * 获取全局战绩统计 (兼容老字段)
   */
  getGameStats() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.GAME_STATS);
      return data || {
        highScore: 0,         // 极速反应挑战最高分 (老字段兼容)
        schulteBestTime: 0,   // 舒尔特方格最佳成绩(秒，老字段兼容)
        totalGames: 0,        // 总游玩局数
        bestCombo: 0,         // 反应力最高连击 (老字段兼容)
        coins: 0              // 累计积分/金币
      };
    } catch (e) {
      console.error('读取游戏统计失败:', e);
      return { highScore: 0, schulteBestTime: 0, totalGames: 0, bestCombo: 0, coins: 0 };
    }
  },

  /**
   * [通用能力] 获取指定游戏的独立存储记录
   * @param {string} gameId 游戏唯一标识 (如 'reaction', 'schulte')
   */
  getGameRecord(gameId) {
    try {
      const recordsMap = wx.getStorageSync(STORAGE_KEYS.GAME_RECORDS) || {};
      return recordsMap[gameId] || null;
    } catch (e) {
      console.error(`读取游戏[${gameId}]记录失败:`, e);
      return null;
    }
  },

  /**
   * [通用能力] 保存指定游戏的独立存储记录
   * @param {string} gameId 游戏唯一标识
   * @param {object} recordData 增量或覆盖的记录对象
   */
  saveGameRecord(gameId, recordData) {
    try {
      const recordsMap = wx.getStorageSync(STORAGE_KEYS.GAME_RECORDS) || {};
      const current = recordsMap[gameId] || {};
      const updated = { ...current, ...recordData, updatedAt: Date.now() };
      recordsMap[gameId] = updated;
      wx.setStorageSync(STORAGE_KEYS.GAME_RECORDS, recordsMap);
      return updated;
    } catch (e) {
      console.error(`保存游戏[${gameId}]记录失败:`, e);
      return null;
    }
  },

  /**
   * [通用能力] 记录单局游戏结果 (自动同步全盘统计、每日战报与独立游戏命名空间)
   * @param {string} gameId 游戏标识
   * @param {object} options
   * @param {number} options.coinsEarned 本局获得金币
   * @param {number} options.dailyScore 本局计入每日积分数值
   * @param {function} options.updater (currentRecord, stats) => ({ updatedRecord, isNewRecord, extraStats })
   */
  recordGamePlay(gameId, options = {}) {
    try {
      const { coinsEarned = 0, dailyScore = 0, updater } = options;
      const stats = this.getGameStats();
      const currentRecord = this.getGameRecord(gameId) || {};

      let isNewRecord = false;
      let newRecordData = {};

      if (typeof updater === 'function') {
        const updateResult = updater(currentRecord, stats) || {};
        newRecordData = updateResult.updatedRecord || {};
        isNewRecord = !!updateResult.isNewRecord;
        if (updateResult.extraStats) {
          Object.assign(stats, updateResult.extraStats);
        }
      }

      // 全局统计累加
      stats.totalGames += 1;
      stats.coins += coinsEarned;
      wx.setStorageSync(STORAGE_KEYS.GAME_STATS, stats);

      // 更新独立存储
      const savedRecord = this.saveGameRecord(gameId, {
        ...newRecordData,
        playCount: (currentRecord.playCount || 0) + 1
      });

      // 累加每日数据
      this._incrementDailyPlay(dailyScore);

      return { stats, record: savedRecord, isNewRecord };
    } catch (e) {
      console.error(`记录游戏[${gameId}]战绩失败:`, e);
      return null;
    }
  },

  /**
   * 记录【极速反应挑战】战绩 (兼容旧接口并同步新旧两套存储)
   */
  recordReactionResult(score, maxCombo = 0) {
    const coins = Math.floor(score / 10);
    return this.recordGamePlay('reaction', {
      coinsEarned: coins,
      dailyScore: score,
      updater: (currentRecord, stats) => {
        const prevBestScore = currentRecord.bestScore !== undefined ? currentRecord.bestScore : (stats.highScore || 0);
        const prevBestCombo = currentRecord.bestCombo !== undefined ? currentRecord.bestCombo : (stats.bestCombo || 0);

        const isNewRecord = score > prevBestScore;
        const newBestScore = Math.max(prevBestScore, score);
        const newBestCombo = Math.max(prevBestCombo, maxCombo);

        return {
          isNewRecord,
          updatedRecord: {
            bestScore: newBestScore,
            bestCombo: newBestCombo,
            lastScore: score
          },
          extraStats: {
            highScore: newBestScore,
            bestCombo: newBestCombo
          }
        };
      }
    });
  },

  /**
   * 记录【舒尔特方格】战绩 (兼容旧接口并同步新旧两套存储)
   * @param {number} timeUsed 用时(秒)
   */
  recordSchulteResult(timeUsed) {
    return this.recordGamePlay('schulte', {
      coinsEarned: 15,
      dailyScore: 10,
      updater: (currentRecord, stats) => {
        const prevBestTime = currentRecord.bestTime !== undefined
          ? currentRecord.bestTime
          : (stats.schulteBestTime || 0);

        const isNewRecord = prevBestTime === 0 || timeUsed < prevBestTime;
        const newBestTime = isNewRecord ? timeUsed : prevBestTime;

        return {
          isNewRecord,
          updatedRecord: {
            bestTime: newBestTime,
            lastTime: timeUsed
          },
          extraStats: {
            schulteBestTime: newBestTime
          }
        };
      }
    });
  },

  /**
   * 记录【合成非洲之心】战绩 (同步独立存储、今日合成数、金币与每日积分)
   * @param {object} resultData
   * @param {number} resultData.score 最终得分
   * @param {number} resultData.money 搜刮身价
   * @param {number} resultData.highestLevel 最高合成等级
   * @param {string} resultData.highestItem 最高道具名称
   * @param {number} resultData.maxCombo 最高连击
   * @param {number} resultData.watermelonCount 本局合成非洲之心(大西瓜)数
   */
  recordWatermelonResult(resultData = {}) {
    const { score = 0, money = 0, highestLevel = 1, highestItem = '', maxCombo = 0, watermelonCount = 0 } = resultData;
    const coins = Math.max(10, Math.floor(money / 10000));
    const today = getTodayString();
    return this.recordGamePlay('watermelon', {
      coinsEarned: coins,
      dailyScore: score,
      updater: (currentRecord, stats) => {
        const prevBestScore = currentRecord.bestScore || 0;
        const prevBestMoney = currentRecord.bestMoney || 0;

        const isNewRecord = score > prevBestScore || money > prevBestMoney;
        const newBestScore = Math.max(prevBestScore, score);
        const newBestMoney = Math.max(prevBestMoney, money);
        const newBestLevel = Math.max(currentRecord.bestLevel || 1, highestLevel);
        const newBestCombo = Math.max(currentRecord.bestCombo || 0, maxCombo);

        // 跨天判断：若记录的不是今天，今日合成数重置从 0 累加
        const prevTodayCount = (currentRecord.todayDate === today) ? (currentRecord.todayWatermelonCount || 0) : 0;
        const newTodayCount = prevTodayCount + watermelonCount;
        const newTotalCount = (currentRecord.totalWatermelonCount || 0) + watermelonCount;

        return {
          isNewRecord,
          updatedRecord: {
            bestScore: newBestScore,
            bestMoney: newBestMoney,
            bestMoneyFormatted: (newBestMoney).toLocaleString('en-US'),
            bestLevel: newBestLevel,
            bestCombo: newBestCombo,
            todayDate: today,
            todayWatermelonCount: newTodayCount,
            totalWatermelonCount: newTotalCount,
            lastScore: score,
            lastMoney: money,
            lastHighestItem: highestItem,
            lastWatermelonCount: watermelonCount
          }
        };
      }
    });
  },

  /**
   * 获取合成非洲之心战绩 (支持跨天自动计算今日合成非洲之心数)
   * @returns {object}
   */
  getWatermelonRecord() {
    try {
      const today = getTodayString();
      const record = this.getGameRecord('watermelon') || {};
      const todayWatermelonCount = (record.todayDate === today)
        ? (record.todayWatermelonCount || 0)
        : 0;
      return {
        ...record,
        todayDate: today,
        todayWatermelonCount
      };
    } catch (e) {
      console.error('获取合成非洲之心记录失败:', e);
      return { todayWatermelonCount: 0 };
    }
  },

  /**
   * 获取今日运势记录 (支持跨天自动重置改运次数)
   * @returns {object} { todayDate, rerollCount, todayFortune, fortuneResult }
   */
  getFortuneRecord() {
    try {
      const today = getTodayString();
      const record = this.getGameRecord('fortune') || {};
      // 跨天判断: 若存储的不是今天的记录，重置今日改运次数
      if (record.todayDate !== today) {
        return {
          todayDate: today,
          rerollCount: 0,
          todayFortune: '待占卜',
          fortuneResult: null
        };
      }
      return {
        todayDate: today,
        rerollCount: record.rerollCount || 0,
        todayFortune: record.todayFortune || '待占卜',
        fortuneResult: record.fortuneResult || null
      };
    } catch (e) {
      console.error('获取今日运势记录失败:', e);
      return { todayDate: getTodayString(), rerollCount: 0, todayFortune: '待占卜', fortuneResult: null };
    }
  },

  /**
   * 保存今日运势记录 (同步独立命名空间并更新大厅展示文案)
   * @param {object} fortuneResult 运势计算完整对象
   * @param {number} rerollCount 当前改运次数
   */
  saveFortuneRecord(fortuneResult, rerollCount = 0) {
    try {
      const today = getTodayString();
      const levelTitle = (fortuneResult && fortuneResult.levelName) || (fortuneResult && fortuneResult.fortune && fortuneResult.fortune.sign) || '小金';
      const itemName = (fortuneResult && fortuneResult.luckyItem && fortuneResult.luckyItem.name) || '未知物资';
      const luckyLevel = (fortuneResult && fortuneResult.luckyLevel) || (fortuneResult && fortuneResult.luckyItem && fortuneResult.luckyItem.level) || 4;
      const colorHex = (fortuneResult && fortuneResult.colorHex) || '#c084fc';

      return this.saveGameRecord('fortune', {
        todayDate: today,
        rerollCount: rerollCount,
        todayFortune: itemName,
        fortuneLevel: luckyLevel,
        fortuneLevelName: levelTitle,
        fortuneColor: colorHex,
        fortuneResult: fortuneResult
      });
    } catch (e) {
      console.error('保存今日运势记录失败:', e);
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
   * 获取今日消除锤剩余数量 (每日首次进入自动赠送 2 把补给)
   * 纯离线单机运行，完全复用 DAILY_RECORDS 跨天自愈
   * @returns {number}
   */
  getTodayHammerCount() {
    try {
      const today = getTodayString();
      const dailyMap = wx.getStorageSync(STORAGE_KEYS.DAILY_RECORDS) || {};
      const todayData = dailyMap[today] || { plays: 0, totalScore: 0 };
      if (!todayData.tools || typeof todayData.tools.hammer !== 'number') {
        todayData.tools = todayData.tools || {};
        todayData.tools.hammer = 2; // 每日赠送 2 把水果消除锤
        dailyMap[today] = todayData;
        wx.setStorageSync(STORAGE_KEYS.DAILY_RECORDS, dailyMap);
      }
      return todayData.tools.hammer;
    } catch (e) {
      console.error('获取今日消除锤数量失败:', e);
      return 2;
    }
  },

  /**
   * 消耗一把今日消除锤
   * @returns {number} 剩余消除锤数量
   */
  consumeTodayHammer() {
    try {
      const today = getTodayString();
      const dailyMap = wx.getStorageSync(STORAGE_KEYS.DAILY_RECORDS) || {};
      const todayData = dailyMap[today] || { plays: 0, totalScore: 0 };
      if (!todayData.tools || typeof todayData.tools.hammer !== 'number') {
        todayData.tools = todayData.tools || {};
        todayData.tools.hammer = 2;
      }
      if (todayData.tools.hammer > 0) {
        todayData.tools.hammer -= 1;
        dailyMap[today] = todayData;
        wx.setStorageSync(STORAGE_KEYS.DAILY_RECORDS, dailyMap);
        return todayData.tools.hammer;
      }
      return 0;
    } catch (e) {
      console.error('消耗今日消除锤失败:', e);
      return 0;
    }
  },

  /**
   * 获取系统设置 (支持音乐开关 musicEnabled 及兼容历史 soundEnabled)
   */
  getSettings() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.SETTINGS);
      if (!data) {
        return {
          musicEnabled: true,
          vibrationEnabled: true
        };
      }
      return {
        musicEnabled: data.musicEnabled !== undefined ? data.musicEnabled : (data.soundEnabled !== undefined ? data.soundEnabled : true),
        vibrationEnabled: data.vibrationEnabled !== undefined ? data.vibrationEnabled : true
      };
    } catch (e) {
      return { musicEnabled: true, vibrationEnabled: true };
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
   * 获取付费特权配置 (辅助瞄准虚线、下一个道具透视、会员身份、额外重抽次数等)
   * @returns {object} { aimGuideLine: boolean, nextItemPreview: boolean, isVipMember: boolean, extraRerollChances: number }
   */
  getPrivileges() {
    try {
      const data = wx.getStorageSync(STORAGE_KEYS.PRIVILEGES);
      return data || {
        aimGuideLine: false,       // 辅助瞄准虚线导轨 (默认隐藏，需付费/会员开启)
        nextItemPreview: false,    // 下一个道具透视预知 (默认打码加锁，需付费/会员开启)
        isVipMember: false,        // 会员身份 (全特权解锁 + 运势无限重抽)
        extraRerollChances: 0      // 运势额外改运次数 (看广告或单独购买获得)
      };
    } catch (e) {
      return { aimGuideLine: false, nextItemPreview: false, isVipMember: false, extraRerollChances: 0 };
    }
  },

  /**
   * 保存特权配置
   * @param {object} privileges
   */
  savePrivileges(privileges) {
    try {
      const current = this.getPrivileges();
      const updated = { ...current, ...privileges };
      wx.setStorageSync(STORAGE_KEYS.PRIVILEGES, updated);
      return updated;
    } catch (e) {
      console.error('保存特权配置失败:', e);
      return null;
    }
  },

  /**
   * 检查指定特权是否已解锁 (若是 VIP 会员直接返回 true)
   * @param {string} privilegeKey
   * @returns {boolean}
   */
  isPrivilegeUnlocked(privilegeKey) {
    const privs = this.getPrivileges();
    if (privs && privs.isVipMember) return true;
    return !!(privs && privs[privilegeKey]);
  },

  /**
   * 检查是否为会员
   * @returns {boolean}
   */
  isVipMember() {
    const privs = this.getPrivileges();
    return !!(privs && privs.isVipMember);
  },

  /**
   * 增加运势额外重抽次数 (看广告或单独购买后调用)
   * @param {number} count 增加次数，默认 1
   */
  addExtraRerollChances(count = 1) {
    const privs = this.getPrivileges();
    const current = privs.extraRerollChances || 0;
    return this.savePrivileges({ extraRerollChances: current + count });
  },

  /**
   * 消耗一次运势额外重抽次数
   * @returns {boolean} 是否消耗成功
   */
  consumeExtraRerollChance() {
    const privs = this.getPrivileges();
    if (privs.isVipMember) return true; // 会员免消耗
    const current = privs.extraRerollChances || 0;
    if (current > 0) {
      this.savePrivileges({ extraRerollChances: current - 1 });
      return true;
    }
    return false;
  },

  /**
   * 解锁指定付费特权 (留给未来支付成功或特权购买回调)
   * @param {string} privilegeKey 'aimGuideLine' | 'nextItemPreview' | 'isVipMember' 等
   */
  unlockPrivilege(privilegeKey) {
    return this.savePrivileges({ [privilegeKey]: true });
  },

  /**
   * 获取当前鼠鼠连连看未完成的对局暂存 (断点续玩)
   * @returns {object|null}
   */
  getLinkSession() {
    try {
      return wx.getStorageSync(STORAGE_KEYS.LINK_ACTIVE_SESSION) || null;
    } catch (e) {
      console.error('读取连连看对局暂存失败:', e);
      return null;
    }
  },

  /**
   * 保存鼠鼠连连看当前对局进度暂存 (断点续玩)
   * @param {object} sessionData
   */
  saveLinkSession(sessionData) {
    try {
      if (!sessionData) return null;
      const data = { ...sessionData, savedAt: Date.now() };
      wx.setStorageSync(STORAGE_KEYS.LINK_ACTIVE_SESSION, data);
      return data;
    } catch (e) {
      console.error('保存连连看对局暂存失败:', e);
      return null;
    }
  },

  /**
   * 清除鼠鼠连连看对局暂存 (游戏结算或主动重开时调用)
   */
  clearLinkSession() {
    try {
      wx.removeStorageSync(STORAGE_KEYS.LINK_ACTIVE_SESSION);
      return true;
    } catch (e) {
      console.error('清除连连看对局暂存失败:', e);
      return false;
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
