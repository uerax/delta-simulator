// pages/fortune/index.js
const FortuneEngine = require('../../games/fortune/engine');
const Feedback = require('../../utils/feedback');
const itemManager = require('../../utils/itemManager');
const Storage = require('../../utils/storage');
const { calculateDailyFortune } = require('../../games/fortune/fortuneAlgorithm');

Page({
  data: {
    gameState: 'ready', // 'ready' | 'generating' | 'revealed'
    fortune: null,
    rerollCount: 0,
    todayDate: '',
    // 广告位开关与占位配置 (方便后续在后台/云控开启对应位置广告)
    adConfig: {
      enableSlotHeader: false, // 顶部插屏/Banner广告位
      enableSlotMid: false,    // 中场原生战术广告位
      enableSlotFooter: false  // 底部激励/Banner广告位
    }
  },

  onLoad(options) {
    this._initEngine();
  },

  onUnload() {
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
  },

  /**
   * 计算地图初始偏置位置 (使地标在右侧紧凑视窗居中呈现)
   */
  _calculateMapOffset(spotCoord) {
    try {
      let windowWidth = 375;
      if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
        const sys = wx.getSystemInfoSync();
        windowWidth = sys.windowWidth || 375;
      }
      const rpxRatio = windowWidth / 750;
      const areaW = 260 * rpxRatio;        // 右侧紧凑视窗宽 (260rpx)
      const areaH = 220 * rpxRatio;        // 右侧紧凑视窗高 (220rpx)
      const viewW = 520 * rpxRatio;        // 2x2 拼图总宽 (520rpx)
      const viewH = 520 * rpxRatio;        // 2x2 拼图总高 (520rpx)

      const coordX = (spotCoord && spotCoord.x !== undefined) ? spotCoord.x : 50;
      const coordY = (spotCoord && spotCoord.y !== undefined) ? spotCoord.y : 50;

      const px = viewW * (coordX / 100);
      const py = viewH * (coordY / 100);

      const idealX = areaW / 2 - px;
      const idealY = areaH / 2 - py;

      const minX = areaW - viewW;
      const minY = areaH - viewH;

      const x = Math.max(minX, Math.min(0, idealX));
      const y = Math.max(minY, Math.min(0, idealY));

      return { x: Math.round(x), y: Math.round(y) };
    } catch (e) {
      return { x: -20, y: -20 };
    }
  },

  /**
   * 规范化运势对象 (确保颜色、主题渐变兼容历史缓存数据，自动升级旧低清缓存为最新高清切片)
   */
  _normalizeFortune(fortune) {
    if (!fortune) return null;

    // 检查缓存是否为旧版低清数据或历史虚构地标，若是则自动自愈升级并回写 Storage
    const isOldData = !fortune.luckyMap ||
      !fortune.luckyMap.startTile ||
      fortune.luckyMap.spot === '主冷却塔' ||
      (Array.isArray(fortune.luckyMap.tiles) && fortune.luckyMap.tiles[0] && fortune.luckyMap.tiles[0].includes('/2_'));

    if (isOldData && this.engine) {
      try {
        const fresh = calculateDailyFortune({
          dateStr: this.engine.todayDate,
          userId: this.engine.userId,
          rerollCount: this.engine.rerollCount,
          isPaid: this.engine.rerollCount > 0
        });
        Storage.saveFortuneRecord(fresh, this.engine.rerollCount);
        this.engine.currentFortune = fresh;
        fortune = fresh;
      } catch (e) {
        console.warn('自动升级旧缓存失败:', e);
      }
    }

    const level = fortune.luckyLevel || (fortune.luckyItem && fortune.luckyItem.level) || 4;
    const theme = itemManager.getLevelTheme(level);

    const colorHex = fortune.colorHex || (fortune.fortune && fortune.fortune.colorHex) || (theme ? theme.colorHex : '#9333EA');
    const bgColorHex = fortune.bgColorHex || (fortune.fortune && fortune.fortune.bgColorHex) || (theme ? theme.bgColor : '#1e1c2c');

    const luckyItem = fortune.luckyItem ? { ...fortune.luckyItem } : {};
    if (!luckyItem.theme && theme) {
      luckyItem.theme = theme;
    }

    const luckyMap = fortune.luckyMap ? { ...fortune.luckyMap } : {};
    if (!luckyMap.tiles || !Array.isArray(luckyMap.tiles) || luckyMap.tiles[0].includes('/2_')) {
      const mapKey = luckyMap.key || 'daba';
      const layerMap = { daba: 'map_db', cgxg: 'map_yc', htjd: 'map_htjd', bks: 'map_bks2', cxjy: 'map_cxjy', az3: 'map_az3' };
      const layer = layerMap[mapKey] || `map_${mapKey}`;
      const sx = (luckyMap.startTile && luckyMap.startTile.x !== undefined) ? luckyMap.startTile.x : 3;
      const sy = (luckyMap.startTile && luckyMap.startTile.y !== undefined) ? luckyMap.startTile.y : 3;
      luckyMap.tiles = [
        `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${layer}/3_${sx}_${sy}.jpg`,
        `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${layer}/3_${sx + 1}_${sy}.jpg`,
        `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${layer}/3_${sx}_${sy + 1}.jpg`,
        `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${layer}/3_${sx + 1}_${sy + 1}.jpg`
      ];
    }

    const offset = this._calculateMapOffset(luckyMap.spotCoord);
    luckyMap.mapOffsetX = offset.x;
    luckyMap.mapOffsetY = offset.y;

    return {
      ...fortune,
      colorHex,
      bgColorHex,
      luckyItem,
      luckyMap
    };
  },

  /**
   * 初始化运势引擎
   */
  _initEngine() {
    this.engine = new FortuneEngine({
      onStateChange: (state) => {
        this.setData({ gameState: state });
      },
      onFortuneRevealed: (result) => {
        const normalized = this._normalizeFortune(result);
        this.setData({
          fortune: normalized,
          rerollCount: this.engine.rerollCount,
          gameState: 'revealed'
        });
      }
    });

    this.engine.init();

    const todayDate = this.engine.todayDate;
    const rerollCount = this.engine.rerollCount;

    // 若今日已有运势结果，直接展示已生成的幂等数据
    if (this.engine.currentFortune) {
      const normalized = this._normalizeFortune(this.engine.currentFortune);
      this.setData({
        fortune: normalized,
        rerollCount: rerollCount,
        todayDate: todayDate,
        gameState: 'revealed'
      });
    } else {
      this.setData({
        todayDate: todayDate,
        rerollCount: rerollCount,
        gameState: 'ready'
      });
    }
  },

  /**
   * 点击开启/测一测今日运势 (免费日常)
   */
  onRevealFortune() {
    try {
      Feedback.medium();
    } catch (e) {}

    if (!this.engine) {
      this._initEngine();
    }

    try {
      const result = this.engine.getTodayFortune();
      const normalized = this._normalizeFortune(result);
      this.setData({
        fortune: normalized,
        rerollCount: this.engine.rerollCount,
        gameState: 'revealed'
      });
      try {
        Feedback.heavy();
      } catch (e) {}
    } catch (err) {
      console.error('获取今日运势失败:', err);
      wx.showToast({ title: '开签异常，请重试', icon: 'none' });
    }
  },

  /**
   * 点击逆天改命 (付费/激励 Reroll，打破旧随机)
   */
  onReroll() {
    try {
      Feedback.light();
    } catch (e) {}

    if (!this.engine) {
      this._initEngine();
    }

    // 若当前已抽到大红，进行友好防呆提示
    if (this.data.fortune && this.data.fortune.luckyLevel === 6) {
      wx.showModal({
        title: '欧气预警',
        content: '今日已是 6级【大红】天命绝密运势！确定还要逆天改命重新抽签吗？',
        confirmText: '坚持改运',
        cancelText: '保留大红',
        confirmColor: '#E03A3E',
        success: (res) => {
          if (res.confirm) {
            this._executeReroll();
          }
        }
      });
      return;
    }

    this._executeReroll();
  },

  /**
   * 执行改运算法与数据刷新
   */
  _executeReroll() {
    try {
      const rerollRes = this.engine.reroll({ isPaid: true });
      const normalized = this._normalizeFortune(rerollRes.fortune);
      this.setData({
        fortune: normalized,
        rerollCount: rerollRes.rerollCount,
        gameState: 'revealed'
      });
      try {
        Feedback.heavy();
      } catch (e) {}
      wx.showToast({
        title: '改运成功！保底已激活',
        icon: 'success',
        duration: 1500
      });
    } catch (err) {
      console.error('改运失败:', err);
      wx.showToast({ title: '改运异常，请重试', icon: 'none' });
    }
  },

  /**
   * 返回大厅
   */
  goHome() {
    try {
      Feedback.light();
    } catch (e) {}

    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});
