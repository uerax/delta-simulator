// pages/fortune/index.js
const FortuneEngine = require('../../games/fortune/engine');
const Feedback = require('../../utils/feedback');
const itemManager = require('../../utils/itemManager');
const supplyManager = require('../../utils/supplyManager');
const Storage = require('../../utils/storage');
const { calculateDailyFortune } = require('../../games/fortune/fortuneAlgorithm');
const { MAP_LANDMARKS } = require('../../games/fortune/fortuneCopywriting');

Page({
  data: {
    gameState: 'ready', // 'ready' | 'generating' | 'revealed'
    fortune: null,
    rerollCount: 0,
    todayDate: '',
    // 8x8 全图 64 张切片数组 (按需懒加载)
    mapTiles: [],
    // 广告位开关与占位配置 (方便后续在后台/云控开启对应位置广告)
    adConfig: {
      enableSlotHeader: false, // 顶部插屏/Banner广告位
      enableSlotMid: false,    // 中场原生战术广告位
      enableSlotFooter: false  // 底部激励/Banner广告位
    }
  },

  onLoad(options) {
    this._loadedTileKeys = new Set();
    this._lastMoveTime = 0;
    this._moveTimer = null;
    this._viewMetrics = null;
    this._initEngine();
  },

  onUnload() {
    if (this._moveTimer) {
      clearTimeout(this._moveTimer);
      this._moveTimer = null;
    }
    if (this._loadedTileKeys) {
      this._loadedTileKeys.clear();
      this._loadedTileKeys = null;
    }
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
  },

  /**
   * 获取并缓存视窗与大地图几何参数 (物理像素尺寸)
   */
  _getViewMetrics() {
    if (this._viewMetrics) return this._viewMetrics;

    let windowWidth = 375;
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      try {
        const sys = wx.getSystemInfoSync();
        windowWidth = sys.windowWidth || 375;
      } catch (e) {}
    }

    const rpxRatio = windowWidth / 750;
    const areaW = 360 * rpxRatio;        // 右侧宽屏视窗宽 (360rpx)
    const areaH = 220 * rpxRatio;        // 右侧宽屏视窗高 (220rpx)
    const viewW = 2048 * rpxRatio;       // 8x8 全图总宽 (2048rpx)
    const viewH = 2048 * rpxRatio;       // 8x8 全图总高 (2048rpx)
    const tilePx = viewW / 8;            // 每个切片物理像素大小 (256rpx)

    this._viewMetrics = {
      windowWidth,
      rpxRatio,
      areaW,
      areaH,
      viewW,
      viewH,
      tilePx
    };

    return this._viewMetrics;
  },

  /**
   * 计算地图初始偏置位置 (使地标在右侧紧凑视窗几何居中呈现)
   */
  _calculateMapOffset(spotCoord) {
    try {
      const metrics = this._getViewMetrics();
      const { areaW, areaH, viewW, viewH } = metrics;

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
      return { x: -600, y: -600 };
    }
  },

  /**
   * 构建 8x8 全图切片数据结构，并在初始状态下仅懒加载地标视口覆盖的切片
   */
  _setupMapTiles(luckyMap) {
    if (!luckyMap) return [];
    if (!this._loadedTileKeys) this._loadedTileKeys = new Set();
    this._loadedTileKeys.clear();

    const layerMap = {
      daba: 'map_db',
      cgxg: 'map_yc',
      htjd: 'map_htjd',
      bks: 'map_bks2',
      cxjy: 'map_cxjy',
      az3: 'map_az3'
    };
    const mapKey = luckyMap.key || 'daba';
    const layer = luckyMap.layer || layerMap[mapKey] || `map_${mapKey}`;
    this._mapLayer = layer;

    const spotCoord = luckyMap.spotCoord || { x: 50, y: 50 };
    const centerCol = Math.min(7, Math.max(0, Math.floor(spotCoord.x / 12.5)));
    const centerRow = Math.min(7, Math.max(0, Math.floor(spotCoord.y / 12.5)));

    // 初始视口中心覆盖范围 (中心地标及其周围 3x3 区域，保证开屏秒开且无黑边)
    const initMinCol = Math.max(0, centerCol - 1);
    const initMaxCol = Math.min(7, centerCol + 1);
    const initMinRow = Math.max(0, centerRow - 1);
    const initMaxRow = Math.min(7, centerRow + 1);

    const cdnBase = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${layer}/`;
    const mapTiles = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const key = `${c}_${r}`;
        const url = `${cdnBase}3_${c}_${r}.jpg`;
        const isInitialVisible = (c >= initMinCol && c <= initMaxCol && r >= initMinRow && r <= initMaxRow);

        if (isInitialVisible) {
          this._loadedTileKeys.add(key);
        }

        mapTiles.push({
          id: `tile_${key}`,
          col: c,
          row: r,
          url: url,
          // 核心懒加载：视口外的切片 src 初始为空字符串，零发起网络请求！
          src: isInitialVisible ? url : ''
        });
      }
    }

    return mapTiles;
  },

  /**
   * 手势拖拽地图移动事件回调 (带有 120ms 节流防御，平滑动态懒加载进入视口的切片)
   */
  onMapMove(e) {
    if (!e || !e.detail) return;
    const curX = e.detail.x;
    const curY = e.detail.y;

    const now = Date.now();
    if (now - this._lastMoveTime < 120) {
      if (this._moveTimer) clearTimeout(this._moveTimer);
      this._moveTimer = setTimeout(() => {
        this._checkTilesInViewport(curX, curY);
      }, 130);
      return;
    }

    this._lastMoveTime = now;
    this._checkTilesInViewport(curX, curY);
  },

  /**
   * 检查视口覆盖的切片并动态按需填充图片 URL (增量局部路径更新，零整表复制)
   */
  _checkTilesInViewport(curX, curY) {
    if (!this.data.mapTiles || this.data.mapTiles.length === 0) return;
    if (!this._loadedTileKeys) this._loadedTileKeys = new Set();

    const metrics = this._getViewMetrics();
    const { areaW, areaH, tilePx } = metrics;

    // 当前大地图在视口内的可视矩形区域 (位移为负值)
    const viewLeft = -curX;
    const viewTop = -curY;
    const viewRight = viewLeft + areaW;
    const viewBottom = viewTop + areaH;

    // 适度增加 0.35 个瓦片的预加载缓冲边距，保证用户向外滑入新区域时无感知平滑展示
    const margin = tilePx * 0.35;
    const minCol = Math.max(0, Math.floor((viewLeft - margin) / tilePx));
    const maxCol = Math.min(7, Math.floor((viewRight + margin) / tilePx));
    const minRow = Math.max(0, Math.floor((viewTop - margin) / tilePx));
    const maxRow = Math.min(7, Math.floor((viewBottom + margin) / tilePx));

    const updates = {};
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = `${c}_${r}`;
        if (!this._loadedTileKeys.has(key)) {
          this._loadedTileKeys.add(key);
          const index = r * 8 + c;
          const tile = this.data.mapTiles[index];
          if (tile && !tile.src) {
            updates[`mapTiles[${index}].src`] = tile.url;
          }
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates);
    }
  },

  /**
   * 规范化运势对象 (确保颜色、主题渐变兼容历史缓存数据，自动升级旧切片为最新全图架构)
   */
  _normalizeFortune(fortune) {
    if (!fortune) return null;

    // 检查缓存是否为旧版数据，若是则自动升级并回写 Storage
    const isOldData = !fortune.luckyMap ||
      !fortune.luckyMap.spotCoord ||
      fortune.luckyMap.spot === '主冷却塔' ||
      (Array.isArray(fortune.luckyMap.tiles) && fortune.luckyMap.tiles.length === 4);

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

    // 强力自愈校准：无论历史缓存残留何种旧坐标，一律使用官方 MAP_LANDMARKS 最新绝对坐标覆盖
    if (luckyMap.key && luckyMap.spot && MAP_LANDMARKS[luckyMap.key]) {
      const landmarks = MAP_LANDMARKS[luckyMap.key].landmarks || [];
      const matched = landmarks.find(lm => lm.name === luckyMap.spot);
      if (matched) {
        luckyMap.spotCoord = { ...matched.coord };
        luckyMap.officialX = matched.officialX;
        luckyMap.officialY = matched.officialY;
        if (matched.tile) {
          luckyMap.centerTile = { ...matched.tile };
        }
      }
    }

    const offset = this._calculateMapOffset(luckyMap.spotCoord);
    luckyMap.mapOffsetX = offset.x;
    luckyMap.mapOffsetY = offset.y;

    const spotCoordX = (luckyMap.spotCoord && luckyMap.spotCoord.x !== undefined) ? luckyMap.spotCoord.x : 50;
    const spotCoordY = (luckyMap.spotCoord && luckyMap.spotCoord.y !== undefined) ? luckyMap.spotCoord.y : 50;
    luckyMap.spotStyle = `left: ${spotCoordX}%; top: ${spotCoordY}%;`;

    // 强力自愈校准：无论历史缓存残留何种旧数据，一律使用 supplyManager 官方最新图片与描述
    let luckyContainer = fortune.luckyContainer ? { ...fortune.luckyContainer } : null;
    if (luckyContainer && luckyContainer.name) {
      const freshContainer = supplyManager.getByName(luckyContainer.name);
      if (freshContainer) {
        luckyContainer = { ...freshContainer };
      }
    }

    const normalized = {
      ...fortune,
      colorHex,
      bgColorHex,
      luckyItem,
      luckyMap,
      luckyContainer: luckyContainer || fortune.luckyContainer
    };

    // 同步更新引擎内存与本地缓存
    if (this.engine) {
      this.engine.currentFortune = normalized;
      Storage.saveFortuneRecord(normalized, this.engine.rerollCount || 0);
    }

    return normalized;
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
        const mapTiles = this._setupMapTiles(normalized.luckyMap);
        this.setData({
          fortune: normalized,
          mapTiles: mapTiles,
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
      const mapTiles = this._setupMapTiles(normalized.luckyMap);
      this.setData({
        fortune: normalized,
        mapTiles: mapTiles,
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
      const mapTiles = this._setupMapTiles(normalized.luckyMap);
      this.setData({
        fortune: normalized,
        mapTiles: mapTiles,
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
   * 点击重新抽签 (每日首次免费，后续走付费/广告特权次数)
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
        content: '今日已是 6级【大红】天命绝密运势！确定还要重新抽签吗？',
        confirmText: '坚持重抽',
        cancelText: '保留大红',
        confirmColor: '#E03A3E',
        success: (res) => {
          if (res.confirm) {
            this._checkRerollEligibilityAndRun();
          }
        }
      });
      return;
    }

    this._checkRerollEligibilityAndRun();
  },

  /**
   * 检查重新抽签资格并执行 (每日首次免费，后续需通过广告或会员获取次数，留好口子)
   */
  _checkRerollEligibilityAndRun() {
    const currentReroll = this.engine.rerollCount || 0;

    // 1. 每日享受 1 次免费重新抽签
    if (currentReroll === 0) {
      this._executeReroll({ isFreeDaily: true, isPaid: false });
      return;
    }

    // 2. 后续重抽：检查会员特权或额外次数
    const isVip = Storage.isVipMember ? Storage.isVipMember() : false;
    const privs = Storage.getPrivileges ? Storage.getPrivileges() : {};
    const extraChances = privs.extraRerollChances || 0;

    if (isVip) {
      // VIP 会员享有无限重抽特权
      this._executeReroll({ isFreeDaily: false, isPaid: true, reason: 'vip' });
      return;
    }

    if (extraChances > 0) {
      // 消耗通过广告/付费获得的额外次数
      Storage.consumeExtraRerollChance();
      this._executeReroll({ isFreeDaily: false, isPaid: true, reason: 'extra' });
      return;
    }

    // 3. 免费机会已用完：功能未上线前直接提示没次数，不弹无效的 ActionSheet 弹窗
    wx.showToast({
      title: '今日重抽次数已用完',
      icon: 'none',
      duration: 1800
    });
  },

  /**
   * 弹出获取重抽次数选择弹窗 (预留接口：待广告/支付上线后开启)
   */
  _showRerollPrivilegeModal() {
    wx.showActionSheet({
      itemList: ['📺 观看广告获得 1 次重抽 (预留)', '👑 开通特权会员无限重抽 (预留)'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.handleWatchAdForReroll();
        } else if (res.tapIndex === 1) {
          this.handlePurchaseVipForReroll();
        }
      },
      fail: () => {}
    });
  },

  /**
   * 观看激励视频广告获取重新抽签次数 (留好口子)
   * @todo 后续接入微信广告组件 wx.createRewardedVideoAd
   */
  handleWatchAdForReroll() {
    try {
      Feedback.light();
    } catch (e) {}

    // @AdHook: 预留微信激励视频广告实例接口
    /*
    if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) {
      const rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: 'YOUR_AD_UNIT_ID' });
      rewardedVideoAd.show().catch(() => rewardedVideoAd.load().then(() => rewardedVideoAd.show()));
      rewardedVideoAd.onClose((res) => {
        if (res && res.isEnded) {
          Storage.addExtraRerollChances(1);
          this._checkRerollEligibilityAndRun();
        }
      });
      return;
    }
    */

    wx.showModal({
      title: '获取重抽次数',
      content: '今日 1 次免费重新抽签机会已用完。激励广告接口联调中，即将开放观看广告获取次数功能！',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 会员特权购买入口 (留好口子)
   * @todo 后续接入微信支付 (wx.requestPayment) 或云开发支付
   */
  handlePurchaseVipForReroll() {
    try {
      Feedback.light();
    } catch (e) {}

    // @PayHook: 预留微信支付接口
    /*
    wx.requestPayment({ ... });
    */

    wx.showModal({
      title: '特权会员专享',
      content: '特权会员可享每日无限重新抽签、合成非洲之心辅助瞄准、下一个道具透视等专属特权，支付接口联调中，即将上线！',
      showCancel: false,
      confirmText: '敬请期待'
    });
  },

  /**
   * 执行改运算法与数据刷新
   */
  _executeReroll(options = {}) {
    const { isFreeDaily = false, isPaid = false, reason = '' } = options;
    try {
      const rerollRes = this.engine.reroll({ isPaid });
      const normalized = this._normalizeFortune(rerollRes.fortune);
      const mapTiles = this._setupMapTiles(normalized.luckyMap);
      this.setData({
        fortune: normalized,
        mapTiles: mapTiles,
        rerollCount: rerollRes.rerollCount,
        gameState: 'revealed'
      });
      try {
        Feedback.heavy();
      } catch (e) {}

      let toastTitle = '重新抽签成功！';
      if (isFreeDaily) {
        toastTitle = '已使用今日免费重抽机会';
      } else if (reason === 'vip') {
        toastTitle = '特权会员：保底已生效';
      } else {
        toastTitle = '改运成功！保底已激活';
      }

      wx.showToast({
        title: toastTitle,
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
