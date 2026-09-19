/**
 * miniprogram/pages/link/index.js
 * 鼠鼠连连看 - 页面控制器 (View Controller)
 * 高性能 Canvas 2D 渲染主循环，零 setData 动效，断点续玩与商业化特权预留
 */

const LinkEngine = require('./engine');
const Storage = require('@/utils/storage');
const Feedback = require('@/utils/feedback');
const MapManager = require('@/utils/mapManager');
const BgmManager = require('@/utils/bgmManager');

function getSafeWindowInfo() {
  if (typeof wx !== 'undefined') {
    if (typeof wx.getWindowInfo === 'function') {
      return wx.getWindowInfo();
    }
    if (typeof wx.getSystemInfoSync === 'function') {
      try {
        return wx.getSystemInfoSync();
      } catch (e) {}
    }
  }
  return { pixelRatio: 2, windowWidth: 667, windowHeight: 375 };
}

/**
 * 跨平台真机安全圆角矩形路径 (彻底替代在部分移动端微信抛错的 ctx.roundRect)
 */
function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

Page({
  data: {
    stage: 1,
    score: 0,
    scoreFormatted: '0',
    timeLeft: 120,
    timeLeftFormatted: '02:00',
    combo: 0,
    pageReady: false,

    // 道具状态
    isHammerActive: false,
    hammerCount: 2,

    // 结算弹窗
    showResultModal: false,
    modalTitle: '撤离成功！',
    isNewRecord: false,
    resultItems: []
  },

  onLoad() {
    this._isNavigating = false;
    this._rafId = null;
    this._canvasInited = false;
    this._canvas = null;
    this._ctx = null;
    this._imgCache = {};

    // 特效系统容器
    this._laserBeams = [];     // 高亮激光折线束
    this._burstParticles = []; // 爆汁水滴火花粒子
    this._shockwaves = [];     // 扩散冲击波光环
    this._floatingTexts = [];  // 身价浮动文字

    // 震动配置
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    this._vibrationEnabled = settings.vibrationEnabled !== false;

    // 消除锤补给 (每日 2 次，跨天自愈)
    const hammerCount = Storage.getTodayHammerCount ? Storage.getTodayHammerCount() : 2;
    this.setData({ hammerCount });

    // 检查是否有未完成的对局存档 (断点续玩)
    const savedSession = Storage.getLinkSession ? Storage.getLinkSession() : null;
    this._initEngine(savedSession);

    this._readyTimer = null;
  },

  onReady() {
    // 微信官方标准规范：横屏转场给予 100ms 布局稳定期，确保 Canvas 节点与物理宽高就绪
    this._readyTimer = setTimeout(() => {
      if (!this._canvasInited) {
        this._initCanvas();
      }
    }, 100);
  },

  onShow() {
    this._isNavigating = false;
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    this._vibrationEnabled = settings.vibrationEnabled !== false;

    // 校准消除锤
    const hammerCount = Storage.getTodayHammerCount ? Storage.getTodayHammerCount() : 2;
    if (this.data.hammerCount !== hammerCount) {
      this.setData({ hammerCount });
    }

    // 播放背景音乐
    BgmManager.play();

    // 恢复游戏与渲染
    if (this._engine && this._engine.gameState === 'paused') {
      this._engine.resume();
    }
    if (this._engine && this._engine.gameState === 'playing' && !this._rafId && this._canvas) {
      this._startRenderLoop();
    }
  },

  onHide() {
    this._stopRenderLoop();
    if (this._engine && this._engine.gameState === 'playing') {
      this._engine.pause();
      this._saveActiveSession();
    }
    BgmManager.pause();
  },

  onUnload() {
    BgmManager.stop();
    if (this._readyTimer) {
      clearTimeout(this._readyTimer);
      this._readyTimer = null;
    }
    this._stopRenderLoop();

    if (this._engine) {
      if (this._engine.gameState === 'playing' || this._engine.gameState === 'paused') {
        this._saveActiveSession();
      }
      this._engine.destroy();
      this._engine = null;
    }

    this._canvasInited = false;
    this._canvas = null;
    this._ctx = null;
    this._imgCache = {};
    this._laserBeams = [];
    this._burstParticles = [];
    this._shockwaves = [];
    this._floatingTexts = [];
    this.setData({ pageReady: false });
    MapManager.clearCache();
  },

  /**
   * 初始化核心纯逻辑引擎
   */
  _initEngine(preservedSession = null) {
    if (this._engine) {
      this._engine.destroy();
    }

    this._engine = new LinkEngine({
      autoInitSilent: false,
      initialStage: preservedSession ? preservedSession.stage : 1,
      initialScore: preservedSession ? preservedSession.score : 0,
      initialTimeLeft: preservedSession ? preservedSession.timeLeft : 120,
      onStateChange: ({ gameState }) => {},
      onScoreUpdate: (data) => {
        this._syncHeaderData(data);
      },
      onTick: ({ timeLeft }) => {
        this._updateTimerDisplay(timeLeft);
      },
      onMatch: ({ p1, p2, path, item, combo, addedScore }) => {
        this._handleMatchSuccess(p1, p2, path, item, combo, addedScore);
      },
      onMismatch: () => {
        Feedback.vibrateShort(this._vibrationEnabled, 'light');
      },
      onShuffle: ({ reason }) => {
        wx.showToast({
          title: reason === 'deadlock_auto' ? '🔀 战术重组完成' : '🔀 战术洗牌',
          icon: 'none',
          duration: 1200
        });
        Feedback.vibrateShort(this._vibrationEnabled, 'medium');
      },
      onStageClear: ({ stage, score, nextStage }) => {
        this._handleStageClear(stage, score, nextStage);
      },
      onGameOver: ({ stage, score, maxCombo }) => {
        this._handleGameOver(stage, score, maxCombo);
      }
    });

    if (preservedSession) {
      this._engine.initStage(preservedSession.stage, preservedSession);
      wx.showToast({ title: '已恢复上局进度', icon: 'none', duration: 1500 });
    }
  },

  /**
   * 初始化 Canvas 2D 画布
   */
  _initCanvas(retryCount = 0) {
    if (this._canvasInited) return;

    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true, size: true }).exec((res) => {
      if (this._canvasInited) return;

      if (!res || !res[0] || !res[0].node) {
        if (retryCount < 20) {
          setTimeout(() => {
            this._initCanvas(retryCount + 1);
          }, 50);
          return;
        }
        console.error('Canvas 节点获取失败 (已重试 20 次)');
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const systemInfo = getSafeWindowInfo();
      const dpr = systemInfo.pixelRatio || 2;
      const rawW = res[0].width;
      const rawH = res[0].height;

      // 若横屏转屏尺寸尚未稳定 (等于0或极小)，继续避峰重试
      if ((!rawW || rawW <= 50 || !rawH || rawH <= 50) && retryCount < 10) {
        setTimeout(() => {
          this._initCanvas(retryCount + 1);
        }, 50);
        return;
      }

      this._canvasInited = true;
      const width = rawW > 0 ? Math.round(rawW) : Math.max(systemInfo.windowWidth, systemInfo.windowHeight);
      const height = rawH > 0 ? Math.round(rawH) : Math.min(systemInfo.windowWidth, systemInfo.windowHeight);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.scale(dpr, dpr);

      this._canvas = canvas;
      this._ctx = ctx;
      this._width = width;
      this._height = height;
      this._dpr = dpr;

      // 抽取本局战术地图背景
      try {
        MapManager.pickSession({ width, height });
      } catch (err) {}

      // 启动游戏主循环与渲染
      this._engine.start();
      this._preloadCurrentLevelImages();
      this._startRenderLoop();

      this.setData({ pageReady: true });
    });
  },

  /**
   * 启动高性能渲染帧循环
   */
  _startRenderLoop() {
    this._stopRenderLoop();

    const render = () => {
      this._renderFrame();
      if (this._canvas) {
        this._rafId = this._canvas.requestAnimationFrame(render);
      }
    };

    if (this._canvas) {
      this._rafId = this._canvas.requestAnimationFrame(render);
    }
  },

  _stopRenderLoop() {
    if (this._rafId && this._canvas) {
      this._canvas.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  /**
   * 每帧渲染核心 (零 setData，满帧 60fps，全局 try-catch 容灾防护)
   */
  _renderFrame() {
    try {
      const ctx = this._ctx;
      const canvas = this._canvas;
      const width = this._width;
      const height = this._height;
      if (!ctx || !canvas || !width || !height || !this._engine) return;

      ctx.clearRect(0, 0, width, height);

      // 1. 绘制战术地图切片背景
      try {
        MapManager.drawBackground(canvas, ctx, width, height, {
          maskColor: 'rgba(15, 18, 26, 0.72)',
          mapAlpha: 0.85,
          showGrid: true,
          showCrosshair: true
        });
      } catch (e) {}

      // 2. 计算棋盘布局几何参数
      const { rows, cols, grid, selectedTile } = this._engine;
      const paddingX = 24;
      const paddingY = 16;
      const availW = width - paddingX * 2;
      const availH = height - paddingY * 2;

      const cellGap = 6;
      const cellW = Math.floor((availW - (cols - 1) * cellGap) / cols);
      const cellH = Math.floor((availH - (rows - 1) * cellGap) / rows);
      const cellSize = Math.min(cellW, cellH, 52); // 最大尺寸限制为 52px

      const boardW = cols * cellSize + (cols - 1) * cellGap;
      const boardH = rows * cellSize + (rows - 1) * cellGap;
      const startX = Math.round((width - boardW) / 2);
      const startY = Math.round((height - boardH) / 2);

      this._boardMetrics = { startX, startY, cellSize, cellGap, rows, cols };

      // 3. 绘制所有方块 (品质底色 + 发光边框 + aspectFit 等比居中贴图)
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const tile = grid[r][c];
          if (!tile) continue;

          const x = startX + (c - 1) * (cellSize + cellGap);
          const y = startY + (r - 1) * (cellSize + cellGap);
          const isSelected = selectedTile && selectedTile.r === r && selectedTile.c === c;

          this._drawTile(ctx, canvas, x, y, cellSize, tile, isSelected);
        }
      }

      // 4. 绘制激光折线束 (QQ 连连看双层高亮脉冲激光)
      this._renderLaserBeams(ctx);

      // 5. 绘制爆汁粒子与光斑
      this._renderParticles(ctx);

      // 6. 绘制扩散冲击波光环
      this._renderShockwaves(ctx);

      // 7. 绘制身价浮动文字
      this._renderFloatingTexts(ctx);
    } catch (frameErr) {
      console.warn('Link renderFrame caught:', frameErr);
    }
  },

  /**
   * 绘制单个方块 (严格按照用户要求的对应等级背景颜色底托与边框)
   */
  _drawTile(ctx, canvas, x, y, size, tile, isSelected) {
    const radius = Math.max(3, Math.round(size * 0.12));
    const colorHex = tile.colorHex || '#9CA3AF';
    const bgColor = tile.bgColor || '#1e2222';

    ctx.save();

    // 1. 绘制方块深暗底色 (采用跨平台 100% 兼容的 drawRoundRect)
    drawRoundRect(ctx, x, y, size, size, radius);
    ctx.fillStyle = 'rgba(18, 22, 32, 0.95)';
    ctx.fill();

    // 2. 叠加半透明高饱和品质底色层
    ctx.fillStyle = bgColor;
    ctx.fill();

    // 3. 绘制品质发光边框
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeStyle = colorHex;
    if (isSelected) {
      ctx.shadowColor = colorHex;
      ctx.shadowBlur = 12;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // 重置阴影

    // 4. 选中态额外绘制四角战术角标高亮
    if (isSelected) {
      const cornerLen = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      // 左上角
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2 + cornerLen);
      ctx.lineTo(x + 2, y + 2);
      ctx.lineTo(x + 2 + cornerLen, y + 2);
      ctx.stroke();
      // 右上角
      ctx.beginPath();
      ctx.moveTo(x + size - 2 - cornerLen, y + 2);
      ctx.lineTo(x + size - 2, y + 2);
      ctx.lineTo(x + size - 2, y + 2 + cornerLen);
      ctx.stroke();
      // 左下角
      ctx.beginPath();
      ctx.moveTo(x + 2, y + size - 2 - cornerLen);
      ctx.lineTo(x + 2, y + size - 2);
      ctx.lineTo(x + 2 + cornerLen, y + size - 2);
      ctx.stroke();
      // 右下角
      ctx.beginPath();
      ctx.moveTo(x + size - 2 - cornerLen, y + size - 2);
      ctx.lineTo(x + size - 2, y + size - 2);
      ctx.lineTo(x + size - 2, y + size - 2 - cornerLen);
      ctx.stroke();
    }

    // 5. 绘制道具图片 (长方形 aspectFit 等比居中缩放，严格参数校验杜绝真机 NaN / 0尺寸报错)
    if (tile.iconUrl) {
      const img = this._getOrLoadImage(canvas, tile.iconUrl);
      if (img && img.width > 0 && img.height > 0 && isFinite(img.width) && isFinite(img.height)) {
        const pad = Math.max(3, Math.round(size * 0.1));
        const drawArea = size - pad * 2;
        const imgW = img.width;
        const imgH = img.height;

        const scale = Math.min(drawArea / imgW, drawArea / imgH);
        if (scale > 0 && isFinite(scale)) {
          const finalW = Math.round(imgW * scale);
          const finalH = Math.round(imgH * scale);
          const imgX = Math.round(x + pad + (drawArea - finalW) / 2);
          const imgY = Math.round(y + pad + (drawArea - finalH) / 2);

          try {
            ctx.drawImage(img, imgX, imgY, finalW, finalH);
          } catch (e) {}
        }
      }
    }

    ctx.restore();
  },

  /**
   * 图片内存缓存与加载
   */
  _getOrLoadImage(canvas, url) {
    if (!url) return null;
    if (this._imgCache[url]) {
      return this._imgCache[url].img;
    }

    if (canvas && typeof canvas.createImage === 'function') {
      const img = canvas.createImage();
      const record = { img, loaded: false };
      img.onload = () => {
        record.loaded = true;
      };
      img.onerror = () => {
        record.error = true;
      };
      img.src = url;
      this._imgCache[url] = record;
      return img;
    }
    return null;
  },

  /**
   * 预加载当前关卡所有涉及的道具图片
   */
  _preloadCurrentLevelImages() {
    if (!this._canvas || !this._engine || !this._engine.grid) return;
    const { rows, cols, grid } = this._engine;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const tile = grid[r][c];
        if (tile && tile.iconUrl) {
          this._getOrLoadImage(this._canvas, tile.iconUrl);
        }
      }
    }
  },

  /**
   * 1:1 复刻 QQ 连连看消除动效 (激光折线 + 爆汁光斑 + 冲击波 + 身价漂浮字)
   */
  _handleMatchSuccess(p1, p2, path, item, combo, addedScore) {
    Feedback.vibrateShort(this._vibrationEnabled, 'light');

    if (!this._boardMetrics) return;
    const { startX, startY, cellSize, cellGap } = this._boardMetrics;

    // 转换折线逻辑坐标为画布像素坐标
    const pixelPath = path.map(pt => {
      const cx = startX + (pt.c - 1) * (cellSize + cellGap) + cellSize / 2;
      const cy = startY + (pt.r - 1) * (cellSize + cellGap) + cellSize / 2;
      return { x: cx, y: cy };
    });

    // 1. 生成双层高亮激光折线束 (持续 150ms)
    this._laserBeams.push({
      path: pixelPath,
      colorHex: item.colorHex || '#E03A3E',
      startTime: Date.now(),
      duration: 150
    });

    // 2. 为 p1 和 p2 生成爆裂粒子与冲击波
    const pos1 = pixelPath[0];
    const pos2 = pixelPath[pixelPath.length - 1];

    [pos1, pos2].forEach(pos => {
      // 冲击波
      this._shockwaves.push({
        x: pos.x,
        y: pos.y,
        radius: 6,
        maxRadius: cellSize * 1.2,
        colorHex: item.colorHex || '#E03A3E',
        startTime: Date.now(),
        duration: 220
      });

      // 14 颗向外飞溅的爆汁火花粒子
      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 80;
        this._burstParticles.push({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2.5 + Math.random() * 2.5,
          colorHex: item.colorHex || '#E03A3E',
          alpha: 1.0,
          startTime: Date.now(),
          duration: 280
        });
      }
    });

    // 3. 生成身价升腾漂浮字 (在两点中点或两端)
    this._floatingTexts.push({
      x: (pos1.x + pos2.x) / 2,
      y: (pos1.y + pos2.y) / 2,
      text: `+¥ ${addedScore.toLocaleString()}`,
      colorHex: item.colorHex || '#FFAA00',
      startTime: Date.now(),
      duration: 500
    });
  },

  /**
   * 渲染高亮激光束
   */
  _renderLaserBeams(ctx) {
    const now = Date.now();
    for (let i = this._laserBeams.length - 1; i >= 0; i--) {
      const beam = this._laserBeams[i];
      const elapsed = now - beam.startTime;
      if (elapsed > beam.duration) {
        this._laserBeams.splice(i, 1);
        continue;
      }

      const progress = elapsed / beam.duration;
      const alpha = Math.max(0, 1 - progress * 0.9);
      const pts = beam.path;
      if (!pts || pts.length < 2) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. 外层脉冲霓虹光晕 (宽 8px)
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) {
        ctx.lineTo(pts[p].x, pts[p].y);
      }
      ctx.strokeStyle = beam.colorHex;
      ctx.globalAlpha = alpha * 0.75;
      ctx.lineWidth = 8;
      ctx.shadowColor = beam.colorHex;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // 2. 内芯白炽光纤 (宽 2.5px)
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) {
        ctx.lineTo(pts[p].x, pts[p].y);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // 3. 折角聚光光核
      for (let p = 1; p < pts.length - 1; p++) {
        ctx.beginPath();
        ctx.arc(pts[p].x, pts[p].y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.restore();
    }
  },

  /**
   * 渲染爆汁火花粒子
   */
  _renderParticles(ctx) {
    const now = Date.now();
    for (let i = this._burstParticles.length - 1; i >= 0; i--) {
      const p = this._burstParticles[i];
      const elapsed = now - p.startTime;
      if (elapsed > p.duration) {
        this._burstParticles.splice(i, 1);
        continue;
      }

      const t = elapsed / 1000;
      const progress = elapsed / p.duration;
      const currentX = p.x + p.vx * t;
      const currentY = p.y + p.vy * t + 30 * t * t; // 微重力
      const currentAlpha = (1 - progress) * p.alpha;

      ctx.save();
      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = p.colorHex;
      ctx.globalAlpha = currentAlpha;
      ctx.fill();
      ctx.restore();
    }
  },

  /**
   * 渲染扩散冲击波
   */
  _renderShockwaves(ctx) {
    const now = Date.now();
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      const s = this._shockwaves[i];
      const elapsed = now - s.startTime;
      if (elapsed > s.duration) {
        this._shockwaves.splice(i, 1);
        continue;
      }

      const progress = elapsed / s.duration;
      const r = s.radius + (s.maxRadius - s.radius) * progress;
      const alpha = (1 - progress) * 0.8;

      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = s.colorHex;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();
    }
  },

  /**
   * 渲染身价浮动文字
   */
  _renderFloatingTexts(ctx) {
    const now = Date.now();
    for (let i = this._floatingTexts.length - 1; i >= 0; i--) {
      const ft = this._floatingTexts[i];
      const elapsed = now - ft.startTime;
      if (elapsed > ft.duration) {
        this._floatingTexts.splice(i, 1);
        continue;
      }

      const progress = elapsed / ft.duration;
      const offsetY = progress * 24; // 向上浮动 24px
      const alpha = 1 - progress;

      ctx.save();
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ft.colorHex;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y - offsetY);
      ctx.restore();
    }
  },

  /**
   * 触控事件处理
   */
  onTouchStart(e) {
    if (!e || !e.touches || !e.touches[0]) return;
    if (!this._boardMetrics || !this._engine) return;

    const touch = e.touches[0];
    const { startX, startY, cellSize, cellGap, rows, cols } = this._boardMetrics;

    const touchX = touch.x;
    const touchY = touch.y;

    // 反查网格坐标
    const col = Math.floor((touchX - startX) / (cellSize + cellGap)) + 1;
    const row = Math.floor((touchY - startY) / (cellSize + cellGap)) + 1;

    if (row >= 1 && row <= rows && col >= 1 && col <= cols) {
      const isHammer = this._engine.toolMode === 'hammer';
      const res = this._engine.handleCellTap(row, col);

      // 消除锤敲碎生效处理 (彻底扣减次数并退出激活态)
      if (isHammer && res && res.type === 'hammer_hit') {
        const remainCount = Storage.consumeTodayHammer ? Storage.consumeTodayHammer() : Math.max(0, this.data.hammerCount - 1);
        this.setData({
          hammerCount: remainCount,
          isHammerActive: false
        });

        Feedback.vibrateShort(this._vibrationEnabled, 'heavy');
        this._handleHammerBurst(res.p1, res.p2, res.item);
        wx.showToast({ title: '战术击碎！', icon: 'none', duration: 800 });
      }
    }
  },

  /**
   * 消除锤成对击碎动效与身价升腾
   */
  _handleHammerBurst(p1, p2, item) {
    if (!this._boardMetrics || !item) return;
    const { startX, startY, cellSize, cellGap } = this._boardMetrics;

    const targets = [p1, p2].filter(Boolean);
    targets.forEach(pt => {
      const cx = startX + (pt.c - 1) * (cellSize + cellGap) + cellSize / 2;
      const cy = startY + (pt.r - 1) * (cellSize + cellGap) + cellSize / 2;

      // 冲击波
      this._shockwaves.push({
        x: cx,
        y: cy,
        radius: 8,
        maxRadius: cellSize * 1.4,
        colorHex: '#e03a3e',
        startTime: Date.now(),
        duration: 260
      });

      // 20 颗向外飞溅的高速火花粒子
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 100;
        this._burstParticles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 3,
          colorHex: i % 2 === 0 ? '#e03a3e' : '#ffaa00',
          alpha: 1.0,
          startTime: Date.now(),
          duration: 320
        });
      }

      // 身价飘字
      this._floatingTexts.push({
        x: cx,
        y: cy,
        text: `🔨 +¥ ${item.price.toLocaleString()}`,
        colorHex: '#ffaa00',
        startTime: Date.now(),
        duration: 550
      });
    });
  },

  /**
   * 切换消除锤敲碎模式
   */
  toggleHammer() {
    if (this.data.hammerCount <= 0) {
      this.onHammerReplenishTap();
      return;
    }

    const nextState = !this.data.isHammerActive;
    this.setData({ isHammerActive: nextState });
    if (this._engine) {
      this._engine.setToolMode(nextState ? 'hammer' : 'none');
    }
    Feedback.vibrateShort(this._vibrationEnabled, 'light');
  },

  cancelHammer() {
    this.setData({ isHammerActive: false });
    if (this._engine) {
      this._engine.setToolMode('none');
    }
  },

  /**
   * 消除锤商业化特权入口预留
   */
  onHammerReplenishTap() {
    wx.showToast({
      title: '看广告/付费补充消除锤即将上线',
      icon: 'none',
      duration: 1800
    });
  },

  /**
   * 关卡通过，连续推进
   */
  _handleStageClear(clearedStage, score, nextStage) {
    Feedback.vibrateShort(this._vibrationEnabled, 'medium');
    wx.showToast({
      title: `🎉 战术突破！进入第 ${nextStage} 关`,
      icon: 'none',
      duration: 1500
    });

    // 实时持久化最高通关记录 (过关立即落盘，杜绝中途退出战绩丢失)
    Storage.recordGamePlay('link', {
      coinsEarned: clearedStage * 100000,
      dailyScore: score,
      updater: (currentRecord) => {
        const oldMaxStage = currentRecord.maxStageCleared || 0;
        const oldBestScore = currentRecord.bestScore || 0;
        const newMaxStage = Math.max(oldMaxStage, clearedStage);
        const newBestScore = Math.max(oldBestScore, score);

        return {
          updatedRecord: {
            maxStageCleared: newMaxStage,
            bestScore: newBestScore
          },
          isNewRecord: newMaxStage > oldMaxStage
        };
      }
    });

    // 重新随机抽取下一关地图背景切片
    try {
      MapManager.pickSession({ width: this._width, height: this._height });
    } catch (e) {}

    this._preloadCurrentLevelImages();

    // 保存当前进度
    this._saveActiveSession();
  },

  /**
   * 倒计时耗尽，撤离失败，弹出结算
   */
  _handleGameOver(stage, score, maxCombo) {
    Feedback.vibrateShort(this._vibrationEnabled, 'heavy');

    // 失败清除对局存档，下次从头开始
    Storage.clearLinkSession();

    // 持久化并统计战绩
    let isNewRecord = false;
    Storage.recordGamePlay('link', {
      coinsEarned: score,
      dailyScore: score,
      updater: (currentRecord) => {
        const oldMaxStage = currentRecord.maxStageCleared || 0;
        const oldBestScore = currentRecord.bestScore || 0;
        const newMaxStage = Math.max(oldMaxStage, stage - 1);
        const newBestScore = Math.max(oldBestScore, score);
        if (newMaxStage > oldMaxStage) isNewRecord = true;

        return {
          updatedRecord: {
            maxStageCleared: newMaxStage,
            bestScore: newBestScore
          },
          isNewRecord
        };
      }
    });

    const resultItems = [
      { label: '搜刮总身价', value: `¥ ${score.toLocaleString()}`, highlight: true, highlightColor: '#f59e0b' },
      { label: '最高通关数', value: `${Math.max(0, stage - 1)} 关`, highlight: isNewRecord, highlightColor: '#e03a3e' },
      { label: '最大连击', value: `${maxCombo} 连击` }
    ];

    this.setData({
      showResultModal: true,
      modalTitle: '撤离超时！',
      isNewRecord,
      resultItems
    });
  },

  /**
   * 返回大厅 (自动保存当前活跃档案)
   */
  goHome() {
    if (this._isNavigating) return;
    this._isNavigating = true;

    if (this._engine && (this._engine.gameState === 'playing' || this._engine.gameState === 'paused')) {
      this._saveActiveSession();
    }

    wx.navigateBack({
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      },
      complete: () => {
        setTimeout(() => {
          this._isNavigating = false;
        }, 300);
      }
    });
  },

  /**
   * 重新开始 (放弃当前进度，清除档案从第 1 关开始)
   */
  confirmRestart() {
    wx.showModal({
      title: '战术重置确认',
      content: '重新开始将放弃当前搜刮进度并重置至第 1 关，确认继续？',
      confirmColor: '#e03a3e',
      success: (res) => {
        if (res.confirm) {
          Storage.clearLinkSession();
          this._initEngine(null);
          this._engine.start();
          try {
            MapManager.pickSession({ width: this._width, height: this._height });
          } catch (e) {}
        }
      }
    });
  },

  onModalRestart() {
    this.setData({ showResultModal: false });
    Storage.clearLinkSession();
    this._initEngine(null);
    this._engine.start();
    try {
      MapManager.pickSession({ width: this._width, height: this._height });
    } catch (e) {}
  },

  _saveActiveSession() {
    if (!this._engine) return;
    const session = this._engine.exportSessionState();
    Storage.saveLinkSession(session);
  },

  _syncHeaderData(data) {
    this.setData({
      stage: data.stage,
      score: data.score,
      scoreFormatted: data.score.toLocaleString(),
      combo: data.combo,
      timeLeft: data.timeLeft
    });
    this._updateTimerDisplay(data.timeLeft);
  },

  _updateTimerDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (this.data.timeLeftFormatted !== formatted) {
      this.setData({ timeLeftFormatted: formatted });
    }
  }
});
