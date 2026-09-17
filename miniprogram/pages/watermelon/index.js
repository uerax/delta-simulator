/**
 * pages/watermelon/index.js
 * 三角洲《合成大西瓜》(合成非洲之心) - 页面控制器
 * 高性能 Canvas 2D 渲染，主循环完全零 setData，物理引擎与状态机驱动
 */

const WatermelonEngine = require('../../games/watermelon/engine');
const { WATERMELON_ITEMS, getItemByLevel } = require('../../games/watermelon/items');
const Storage = require('../../utils/storage');
const Feedback = require('../../utils/feedback');
const MapManager = require('../../utils/mapManager');

const defaultFirstItem = getItemByLevel(1);

// 安全获取窗口与屏幕信息 (彻底消除 wx.getSystemInfoSync is deprecated 告警)
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
  return { pixelRatio: 2, windowWidth: 375, windowHeight: 667 };
}

Page({
  data: {
    score: 0,
    moneyFormatted: '0',
    combo: 0,
    isWarning: false,
    nextItem: defaultFirstItem, // 静态预置初始首发道具，开屏零等待，杜绝 DOM 二次重排
    pageReady: false,           // 整页一体化呈现门控：顶部/画布/底部同一时刻整体亮起
    showResultModal: false,
    modalTitle: '搜刮撤离完成！',
    isNewRecord: false,
    resultItems: []
  },

  onLoad() {
    this._isNavigating = false;
    this._rafId = null;
    this._lastFrameTime = 0;
    this._imgCache = {};
    this._shockwaves = []; // 爆炸光环视觉粒子
    this._mergeParticles = []; // 1:1 对标斗鱼 Cocos 合成爆汁飞溅遮瑕粒子 (中心光爆 + 果汁水滴)
    this._floatingTexts = []; // 连击与加分漂浮字
    this._readyFruitTrails = []; // 1:1 对标斗鱼 Cocos 瞄准平移残影拖尾
    this._isDragging = false;
    this._canvasInited = false;

    // 读取用户震动配置
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    this._vibrationEnabled = settings.vibrationEnabled !== false;
  },

  onReady() {
    // 立即启动 Canvas 查找与首帧绘制，首帧就绪后一次性整体点亮全页，绝不分步露馅
    if (!this._canvasInited) {
      this._initCanvas();
    }
  },

  onShow() {
    this._isNavigating = false;
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    this._vibrationEnabled = settings.vibrationEnabled !== false;

    // 如果切后台暂停，恢复帧循环
    if (this._engine && this._engine.gameState === 'playing' && !this._rafId && this._canvas) {
      this._lastFrameTime = Date.now();
      this._startRenderLoop();
    }
  },

  onHide() {
    this._stopRenderLoop();
  },

  onUnload() {
    this._stopRenderLoop();
    if (this._engine) {
      this._engine.destroy();
      this._engine = null;
    }
    this._canvasInited = false;
    this._canvas = null;
    this._ctx = null;
    this._imgCache = {};
    this._shockwaves = [];
    this._mergeParticles = [];
    this._floatingTexts = [];
    this._readyFruitTrails = [];
    this.setData({ pageReady: false });
    MapManager.clearCache();
  },

  /**
   * 初始化 Canvas 2D 画布 (带节点就绪容错与重试机制)
   */
  _initCanvas(retryCount = 0) {
    if (this._canvasInited) return;

    // 严禁使用 .in(this)，在 Page 作用域下直接使用 wx.createSelectorQuery()
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true, size: true }).exec((res) => {
      if (this._canvasInited) return;

      if (!res || !res[0] || !res[0].node) {
        if (retryCount < 15) {
          setTimeout(() => {
            this._initCanvas(retryCount + 1);
          }, 40); // 缩短轮询间隔至 40ms，消除不必要的等待延迟
          return;
        }
        console.error('Canvas 节点获取失败 (已重试 15 次)');
        return;
      }

      this._canvasInited = true;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Canvas 2D context 获取失败');
        return;
      }

      const systemInfo = getSafeWindowInfo();
      const dpr = systemInfo.pixelRatio || 2;

      // 宽高校验与 1:1 斗鱼官方 STAGE_LAYOUT (702:976) 长宽比严格锁定
      const rawW = res[0].width;
      const width = (rawW && rawW > 0) ? Math.round(rawW) : (systemInfo.windowWidth || 360);
      // 严格 1:1 基于斗鱼官方舞台比例 (702:976) 计算画布高度，多余长度留给广告展位
      const height = Math.round(width * (976 / 702));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      this._canvas = canvas;
      this._ctx = ctx;
      this._width = width;
      this._height = height;
      this._dpr = dpr;

      // 抽取本局战术地图背景切片
      try {
        MapManager.pickSession({ width, height });
      } catch (err) {
        console.warn('MapManager.pickSession safe caught:', err);
      }

      // 优先轻量载入开局首批道具 (Lv.1~Lv.2) 贴图，其余道具后置加载，彻底避免抢占转场动画 CPU/网络
      this._preloadInitialImages();

      // 创建核心引擎
      this._setupEngine(width, height);

      // 启动游戏状态机
      this._engine.start();
      this._lastFrameTime = Date.now();

      // 立即同步渲染首帧，杜绝依赖 rAF 首帧延迟导致的视觉空白
      try {
        this._renderFrame(0.016);
      } catch (err) {
        console.warn('First frame render caught:', err);
      }

      // 首帧已就绪，整页（状态栏+画布+按钮）作为一个整体同时点亮！
      this.setData({ pageReady: true });

      // 启动 60 FPS Canvas 渲染主循环
      this._startRenderLoop();

      // 避峰加载：在页面转场动画完毕后 (约 350ms) 再静默拉取其余高阶大金道具贴图
      setTimeout(() => {
        this._preloadRemainingImages();
      }, 350);
    });
  },

  /**
   * 优先加载开局所需的低阶道具贴图
   */
  _preloadInitialImages() {
    if (!this._canvas || typeof this._canvas.createImage !== 'function') return;
    const initialItems = WATERMELON_ITEMS.slice(0, 2);
    initialItems.forEach(item => {
      this._loadItemImage(item);
    });
  },

  /**
   * 静默预加载剩余高阶道具贴图
   */
  _preloadRemainingImages() {
    if (!this._canvas || typeof this._canvas.createImage !== 'function') return;
    const remainingItems = WATERMELON_ITEMS.slice(2);
    remainingItems.forEach(item => {
      this._loadItemImage(item);
    });
  },

  /**
   * 单张道具图片加载与安全缓存
   */
  _loadItemImage(item) {
    if (this._imgCache[item.level]) return;
    try {
      const img = this._canvas.createImage();
      img._loaded = false;
      img.onload = () => {
        img._loaded = true;
      };
      img.onerror = () => {
        img._loaded = false;
      };
      img.src = item.iconUrl;
      this._imgCache[item.level] = img;
    } catch (e) {
      console.warn('createImage failed for level', item.level, e);
    }
  },

  /**
   * 组装逻辑引擎与事件中继 (1:1 对齐斗鱼官方相对高度比例)
   */
  _setupEngine(width, height) {
    this._engine = new WatermelonEngine({
      width: width,
      height: height,
      dropY: Math.round(height * 0.055),   // 对标斗鱼待释放水果顶部居中挂载点
      dangerY: Math.round(height * 0.125), // 对标斗鱼顶部警戒线高度 (约占舞台上沿向下 12.5%)
      onScoreUpdate: ({ score, moneyFormatted, combo }) => {
        this.setData({
          score,
          moneyFormatted,
          combo
        });
      },
      onFruitSpawn: ({ nextItem }) => {
        this.setData({ nextItem });
      },
      onDangerWarning: (isWarning) => {
        this.setData({ isWarning });
        if (isWarning) {
          Feedback.vibrateShort(this._vibrationEnabled, 'medium');
        }
      },
      onMerge: ({ level, item, spawnX, spawnY, combo, addedMoney, addedScore, newBody }) => {
        // 1. 1:1 对标斗鱼 Cocos createMergeEffect：全套合成爆汁遮瑕特效 (中心光晕爆闪 + 18 颗彩色果汁飞溅水滴)
        this._createMergeBurstEffects(spawnX, spawnY, item.radius, item.colorHex);

        // 2. 1:1 对标斗鱼 Cocos Fruit2.ts playAppear("merge")：尺寸严格 1:1 绝不膨胀变形，透明度 210 在 0.10s 内平滑淡入
        if (newBody) {
          newBody.appearAlpha = 210 / 255;
          newBody.appearDuration = 0.10;
          newBody.appearElapsed = 0;
        }

        // 3. 添加浮动得分/身价文字 (Floating Score)
        const comboTag = combo > 1 ? ` (x${combo}连击!)` : '';
        this._floatingTexts.push({
          x: spawnX,
          y: spawnY - item.radius - 8,
          text: `+¥${item.priceFormatted || item.price}${comboTag}`,
          color: item.colorHex,
          alpha: 1.0,
          scale: combo > 1 ? 1.2 : 1.0
        });
      },
      onAimTrail: ({ startX, targetX, radius, level, dist }) => {
        this._createReadyFruitTrails(startX, targetX, radius, level, dist);
      },
      onFeedback: (fb) => {
        if (fb.type === 'drop') {
          Feedback.vibrateShort(this._vibrationEnabled, 'light');
        } else if (fb.type === 'merge') {
          if (fb.isBigGold) {
            Feedback.vibrateLong(this._vibrationEnabled);
          } else {
            Feedback.vibrateShort(this._vibrationEnabled, fb.combo > 2 ? 'heavy' : 'medium');
          }
        } else if (fb.type === 'gameover') {
          Feedback.vibrateLong(this._vibrationEnabled);
        }
      },
      onGameOver: (resultData) => {
        this._handleGameOver(resultData);
      }
    });

    // 初始状态挂载到界面 (仅当与当前 data 存在不一致时才 setData，杜绝首屏多余通信)
    const initial = this._engine.getInitialState();
    if (!this.data.nextItem || this.data.nextItem.id !== initial.nextItem.id || this.data.score !== initial.score) {
      this.setData({
        nextItem: initial.nextItem,
        score: initial.score,
        moneyFormatted: initial.moneyFormatted
      });
    }
  },

  /**
   * 启动渲染与物理驱动帧循环 (严格零 setData，带跨端 rAF 兼容)
   */
  _startRenderLoop() {
    if (this._rafId) return;

    // 跨环境 rAF 调度器：优先 canvas.requestAnimationFrame，次选 wx.requestAnimationFrame，保底 setTimeout
    const requestNext = (fn) => {
      if (this._canvas && typeof this._canvas.requestAnimationFrame === 'function') {
        return this._canvas.requestAnimationFrame(fn);
      }
      if (typeof wx.requestAnimationFrame === 'function') {
        return wx.requestAnimationFrame(fn);
      }
      return setTimeout(fn, 16);
    };

    const loop = () => {
      const now = Date.now();
      const rawDt = this._lastFrameTime > 0 ? (now - this._lastFrameTime) / 1000 : 0.016;
      const dt = Math.max(0.001, Math.min(rawDt, 0.033));
      this._lastFrameTime = now;

      // 1. 物理世界与游戏逻辑更新
      if (this._engine && this._engine.gameState === 'playing') {
        this._engine.update(dt);
      }

      // 2. 画布渲染
      this._renderFrame(dt);

      // 3. 驱动下一帧
      if (this._canvas && this._engine && this._engine.gameState === 'playing') {
        this._rafId = requestNext(loop);
      } else {
        this._rafId = null;
      }
    };

    this._rafId = requestNext(loop);
  },

  /**
   * 停止帧循环
   */
  _stopRenderLoop() {
    if (this._rafId) {
      if (this._canvas && typeof this._canvas.cancelAnimationFrame === 'function') {
        this._canvas.cancelAnimationFrame(this._rafId);
      } else if (typeof wx.cancelAnimationFrame === 'function') {
        wx.cancelAnimationFrame(this._rafId);
      } else {
        clearTimeout(this._rafId);
      }
      this._rafId = null;
    }
  },

  /**
   * 渲染单帧画面 (带全局崩溃拦截与容错)
   */
  _renderFrame(dt = 0.016) {
    const ctx = this._ctx;
    const width = this._width;
    const height = this._height;
    if (!ctx || !this._engine) return;

    try {
      // 清空背景
      ctx.clearRect(0, 0, width, height);

      // 结算弹窗展示期间，完全清空画布并停止绘制小球与警戒线，物理消除模拟器同层图层遮挡
      if (this.data.showResultModal) {
        return;
      }

      // 1. 绘制战术地图背景与科技网格 (MapManager 方案B，带原生网格优雅降级兜底)
      try {
        MapManager.drawBackground(this._canvas, ctx, width, height, {
          maskColor: 'rgba(15, 18, 26, 0.80)',
          mapAlpha: 0.38,
          showGrid: true,
          showCrosshair: true
        });
      } catch (err) {
        ctx.save();
        ctx.fillStyle = '#090d13';
        ctx.fillRect(0, 0, width, height);
        this._drawTacticalGrid(ctx, width, height);
        ctx.restore();
      }

      // 2. 绘制顶部警戒红线 (带呼吸警示虚线)
      this._drawDangerLine(ctx, width);

      // 3. 绘制顶部准星与投掷导轨
      this._drawDropperGuide(ctx, height);

      // 4. 绘制物理世界中所有小球道具 (带弹性弹出动画)
      const bodies = this._engine.physics.bodies;
      for (let i = 0; i < bodies.length; i++) {
        this._drawFruit(ctx, bodies[i], dt);
      }

      // 4.5 绘制 1:1 斗鱼瞄准滑动残影拖尾
      this._drawReadyFruitTrails(ctx, dt);

      // 5. 绘制待下落的当前道具 (位于顶部准星处)
      if (this._engine.gameState === 'playing' && !this._engine.isDropping) {
        this._drawCurrentHeldFruit(ctx);
      }

      // 6. 绘制合成冲击波与 1:1 斗鱼爆汁遮瑕飞溅粒子
      this._drawShockwaves(ctx);
      this._drawMergeParticles(ctx, dt);

      // 7. 绘制连击与身价浮动文字
      this._drawFloatingTexts(ctx, dt);
    } catch (err) {
      console.warn('_renderFrame safe caught:', err);
    }
  },

  /**
   * 绘制战术网格底纹
   */
  _drawTacticalGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * 绘制顶部警戒线 (带呼吸警示动效)
   */
  _drawDangerLine(ctx, width) {
    const dangerY = this._engine.dangerY;
    const isWarning = this.data.isWarning;

    ctx.save();
    // 危险时呼吸动态波动透明度
    let alpha = 0.4;
    if (isWarning) {
      const breath = (Math.sin(Date.now() / 150) + 1) / 2; // 0 ~ 1 呼吸波
      alpha = 0.45 + 0.55 * breath;
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1;
    }

    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(width, dangerY);
    ctx.stroke();

    // 警戒标签小字
    ctx.fillStyle = isWarning ? `rgba(239, 68, 68, ${alpha})` : 'rgba(239, 68, 68, 0.4)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('DANGER LINE', width - 85, dangerY - 6);
    ctx.restore();
  },

  /**
   * 绘制准星虚线导轨
   */
  _drawDropperGuide(ctx, height) {
    if (this._engine.gameState !== 'playing' || this._engine.isDropping) return;

    const x = this._engine.currentFruitX;
    const dropY = this._engine.dropY;

    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);

    ctx.beginPath();
    ctx.moveTo(x, dropY);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
  },

  /**
   * 绘制顶部待下落果实
   */
  _drawCurrentHeldFruit(ctx) {
    const level = this._engine.currentLevel;
    const item = getItemByLevel(level, this._width);
    if (!item) return;

    const x = this._engine.currentFruitX;
    const y = this._engine.dropY;
    const radius = item.radius;
    const lineWidth = 2.5;

    ctx.save();
    ctx.translate(x, y);

    // 1:1 对标斗鱼 playAppear("spawn") 淡入动效
    const alpha = (this._engine && this._engine.heldFruitAlpha !== undefined)
      ? this._engine.heldFruitAlpha
      : 1.0;
    ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));

    // 1. 绘制圆形底色
    ctx.fillStyle = item.bgColorHex || '#1e2222';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 贴入高清道具图 (等比包含缩放，防拉伸变形，未载入时优雅降级文字)
    const img = this._imgCache[level];
    let imageDrawn = false;

    if (img && (img._loaded || img.width > 0) && img.width > 0 && img.height > 0) {
      try {
        const contentRadius = radius * 0.76;
        const maxDim = contentRadius * 2;
        let drawW = maxDim;
        let drawH = maxDim;

        const aspect = img.width / img.height;
        if (aspect >= 1) {
          drawW = maxDim;
          drawH = maxDim / (aspect || 1);
        } else {
          drawH = maxDim;
          drawW = maxDim * aspect;
        }

        // 移除高开销的每帧每球 ctx.clip()，贴图内置 24% 呼吸空隙无溢出风险
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        imageDrawn = true;
      } catch (e) {
        // 贴图异常容错
      }
    }

    // 降级兜底：图片未准备好时居中绘制品质等级
    if (!imageDrawn && radius >= 12) {
      ctx.save();
      ctx.fillStyle = item.colorHex || '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.round(radius * 0.55))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`L${level}`, 0, 0);
      ctx.restore();
    }

    // 3. 往内部绘制高亮圆环边框 (内描边，外缘严格贴合物理圆)
    ctx.strokeStyle = item.colorHex;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const strokeRadius = Math.max(0, radius - lineWidth / 2);
    ctx.arc(0, 0, strokeRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },

  /**
   * 绘制物理小球 (带刚体旋转、弹性缩放动画与高光描边)
   */
  _drawFruit(ctx, body, dt = 0.016) {
    if (body.isMerging) return;
    const item = getItemByLevel(body.level);
    if (!item) return;

    // 1. 1:1 对标斗鱼 Cocos Fruit2.ts playAppear("merge") 透明度平滑淡入 (尺寸绝对保持 1:1 物理真实比例，严禁形变膨胀)
    let alpha = 1.0;
    if (body.appearDuration !== undefined && body.appearDuration > 0) {
      body.appearElapsed += dt;
      const p = Math.min(1.0, body.appearElapsed / body.appearDuration);
      alpha = body.appearAlpha + (1.0 - body.appearAlpha) * p;
      if (p >= 1.0) {
        delete body.appearAlpha;
        delete body.appearDuration;
        delete body.appearElapsed;
      }
    }

    ctx.save();
    ctx.translate(body.x, body.y);
    if (alpha < 1.0) {
      ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));
    }
    ctx.rotate(body.angle); // 贴图随刚体真实旋转滚动

    const radius = body.radius;
    const lineWidth = body.level >= 9 ? 3.5 : 2; // 高阶大金加粗高光

    // 1. 圆形底色
    ctx.fillStyle = item.bgColorHex || '#1e2222';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 贴入高清道具图 (等比包含缩放，防拉伸变形)
    const img = this._imgCache[body.level];
    let imageDrawn = false;

    if (img && (img._loaded || img.width > 0) && img.width > 0 && img.height > 0) {
      try {
        const contentRadius = radius * 0.76;
        const maxDim = contentRadius * 2;
        let drawW = maxDim;
        let drawH = maxDim;

        const aspect = img.width / img.height;
        if (aspect >= 1) {
          drawW = maxDim;
          drawH = maxDim / (aspect || 1);
        } else {
          drawH = maxDim;
          drawW = maxDim * aspect;
        }

        // 移除高开销的每帧每球 ctx.clip()，贴图内置 24% 呼吸空隙无溢出风险
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        imageDrawn = true;
      } catch (e) {
        // 贴图异常容错
      }
    }

    // 降级兜底：图片未准备好时居中绘制品质等级
    if (!imageDrawn && radius >= 12) {
      ctx.save();
      ctx.fillStyle = item.colorHex || '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.round(radius * 0.52))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`L${body.level}`, 0, 0);
      ctx.restore();
    }

    // 3. 往内部绘制品质外光圈边框 (内描边，外缘严格贴合物理圆)
    ctx.strokeStyle = item.colorHex;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const strokeRadius = Math.max(0, radius - lineWidth / 2);
    ctx.arc(0, 0, strokeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 4. 绝密终极大金“非洲之心”专属内部钻石辉光
    if (item.isUltimate) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, strokeRadius - 4), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  },

  /**
   * 生成瞄准滑动残影拖尾 (1:1 斗鱼 Cocos createReadyFruitMoveTrail)
   */
  _createReadyFruitTrails(startX, targetX, radius, level, r) {
    const item = getItemByLevel(level, this._width);
    if (!item) return;

    // 1:1 斗鱼算法: 每 90 像素生成 1 个残影，数量夹紧在 3 ~ 7 之间
    const n = Math.min(7, Math.max(3, Math.ceil(r / 90)));
    for (let i = 0; i < n; i++) {
      const ratio = (i + 1) / (n + 1);
      this._readyFruitTrails.push({
        x: startX + (targetX - startX) * ratio,
        y: this._engine.dropY,
        radius: radius,
        level: level,
        item: item,
        // 1:1 斗鱼初始透明度: Math.max(48, Math.round(150 * (1 - ratio))) / 255
        initialAlpha: Math.max(48, Math.round(150 * (1 - ratio))) / 255,
        delay: 0.012 * i, // 1:1 斗鱼阶梯延迟: 0.012s * i
        duration: 0.18,   // 1:1 斗鱼淡出耗时: 0.18s
        elapsed: 0
      });
    }
  },

  /**
   * 绘制并衰减瞄准滑动残影拖尾
   */
  _drawReadyFruitTrails(ctx, dt = 0.016) {
    if (!this._readyFruitTrails || this._readyFruitTrails.length === 0) return;

    ctx.save();
    for (let i = this._readyFruitTrails.length - 1; i >= 0; i--) {
      const tr = this._readyFruitTrails[i];
      tr.elapsed += dt;
      if (tr.elapsed < tr.delay) continue;

      const p = (tr.elapsed - tr.delay) / tr.duration;
      if (p >= 1.0) {
        this._readyFruitTrails.splice(i, 1);
        continue;
      }

      const alpha = tr.initialAlpha * (1.0 - p);
      ctx.globalAlpha = Math.max(0, Math.min(1.0, alpha));

      // 1. 绘制圆形底色
      ctx.fillStyle = tr.item.bgColorHex || '#1e2222';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.radius, 0, Math.PI * 2);
      ctx.fill();

      // 2. 贴入半透明道具图 (防溢出安全边距)
      const img = this._imgCache[tr.level];
      if (img && (img._loaded || img.width > 0) && img.width > 0 && img.height > 0) {
        const contentRadius = tr.radius * 0.76;
        const maxDim = contentRadius * 2;
        const aspect = img.width / img.height;
        let drawW = maxDim;
        let drawH = maxDim;
        if (aspect >= 1) {
          drawH = maxDim / (aspect || 1);
        } else {
          drawW = maxDim * aspect;
        }
        ctx.drawImage(img, tr.x - drawW / 2, tr.y - drawH / 2, drawW, drawH);
      }

      // 3. 绘制半透明外圆边框
      ctx.strokeStyle = tr.item.colorHex;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, Math.max(0, tr.radius - 0.75), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * 绘制并衰减合成冲击波特效
   */
  _drawShockwaves(ctx) {
    if (this._shockwaves.length === 0) return;

    ctx.save();
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      const sw = this._shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.18;
      sw.alpha -= 0.04;

      if (sw.alpha <= 0) {
        this._shockwaves.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * 1:1 对标斗鱼 Cocos createMergeEffect：生成合成爆汁飞溅遮瑕粒子
   * @param {number} x 合成生成 X 坐标
   * @param {number} y 合成生成 Y 坐标
   * @param {number} radius 新水果半径
   * @param {string} colorHex 道具品质主题色
   */
  _createMergeBurstEffects(x, y, radius, colorHex) {
    if (!this._mergeParticles) this._mergeParticles = [];

    // 1. 中心光爆光晕 (Merge Flash Splat：0.12s 快速膨胀淡出，高光遮掩两球消失与新球刷出瞬间)
    this._mergeParticles.push({
      type: 'flash',
      x,
      y,
      radius: radius * 0.4,
      maxRadius: radius * 1.5,
      color: '#FFFFFF',
      tintColor: colorHex || '#FFFFFF',
      alpha: 0.95,
      duration: 0.12,
      elapsed: 0
    });

    // 2. 18 颗彩色果汁飞溅水滴 (Juice Droplets：向四周高速径向爆散，带重力下坠微弧线与渐隐)
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const speed = radius * (3.0 + Math.random() * 3.5);
      const pRadius = Math.max(1.8, Math.min(4.2, radius * (0.07 + Math.random() * 0.05)));
      this._mergeParticles.push({
        type: 'droplet',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        gravity: 480, // 重力加速度
        radius: pRadius,
        color: colorHex || '#FFFFFF',
        alpha: 0.95,
        duration: 0.26 + Math.random() * 0.08,
        elapsed: 0
      });
    }
  },

  /**
   * 绘制并更新 1:1 斗鱼合成爆汁遮瑕飞溅粒子
   */
  _drawMergeParticles(ctx, dt = 0.016) {
    if (!this._mergeParticles || this._mergeParticles.length === 0) return;

    ctx.save();
    for (let i = this._mergeParticles.length - 1; i >= 0; i--) {
      const p = this._mergeParticles[i];
      p.elapsed += dt;
      if (p.elapsed >= p.duration) {
        this._mergeParticles.splice(i, 1);
        continue;
      }

      const progress = p.elapsed / p.duration;

      if (p.type === 'flash') {
        // 中心光爆：迅速膨胀并极速淡出，完美遮瑕
        const r = p.radius + (p.maxRadius - p.radius) * progress;
        const a = p.alpha * (1.0 - progress);
        ctx.globalAlpha = Math.max(0, a);

        // 外层品质柔光
        ctx.fillStyle = p.tintColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        // 核心高光白爆
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'droplet') {
        // 水滴粒子：带重力位移与自然缩小淡出
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const a = p.alpha * (1.0 - progress * progress);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius * (1.0 - progress * 0.4)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  /**
   * 绘制浮动计分文字 (Floating Text)
   */
  _drawFloatingTexts(ctx, dt = 0.016) {
    if (this._floatingTexts.length === 0) return;

    ctx.save();
    for (let i = this._floatingTexts.length - 1; i >= 0; i--) {
      const ft = this._floatingTexts[i];
      ft.y -= 35 * dt; // 向上浮动
      ft.alpha -= 1.2 * dt; // 平滑淡出

      if (ft.alpha <= 0) {
        this._floatingTexts.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `bold ${Math.round(14 * ft.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 黑色描边增强对比度
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);

      // 主体高光文字
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  },

  /**
   * 触摸事件中继
   */
  onTouchStart(e) {
    if (this.data.showResultModal) return;
    if (!this._engine || this._engine.gameState !== 'playing') return;
    const touch = e.touches[0];
    if (!touch) return;

    this._isDragging = true;
    this._engine.moveDropper(touch.x);
  },

  onTouchMove(e) {
    if (this.data.showResultModal) return;
    if (!this._isDragging || !this._engine) return;
    const touch = e.touches[0];
    if (!touch) return;

    this._engine.moveDropper(touch.x);
  },

  onTouchEnd(e) {
    if (this.data.showResultModal) return;
    if (!this._engine) return;
    this._isDragging = false;

    // 获取手指松开位置，快速释放
    const touch = e.changedTouches ? e.changedTouches[0] : null;
    const releaseX = touch ? touch.x : null;

    this._engine.dropCurrentFruit(releaseX);
  },

  /**
   * 处理游戏结束结算
   */
  _handleGameOver(resultData) {
    // 保存战绩至本地 Storage
    const saveResult = Storage.recordWatermelonResult({
      score: resultData.score,
      money: resultData.money,
      highestLevel: resultData.highestLevel,
      highestItem: resultData.highestItem,
      maxCombo: resultData.maxCombo
    });

    const isNewRecord = saveResult ? saveResult.isNewRecord : false;

    const resultItems = [
      { label: '搜刮总身价', value: `¥ ${resultData.moneyFormatted}`, highlight: true, highlightColor: '#fbbf24' },
      { label: '当局得分', value: `${resultData.score} 分` },
      { label: '最高合成大金', value: resultData.highestItem, highlight: resultData.highestLevel >= 9, highlightColor: '#e03a3e' },
      { label: '最大连击', value: `${resultData.maxCombo} 连击` },
      { label: '投入物资数', value: `${resultData.dropCount} 件` }
    ];

    this.setData({
      showResultModal: true,
      modalTitle: resultData.highestLevel >= 11 ? '👑 成功合成非洲之心！' : '撤离结算完成！',
      isNewRecord,
      resultItems
    });
  },

  /**
   * 重新开始游戏
   */
  restartGame() {
    this.setData({
      showResultModal: false,
      score: 0,
      moneyFormatted: '0',
      combo: 0,
      isWarning: false
    });

    // 重新抽取下一局战术地图切片
    MapManager.pickSession({ width: this._width, height: this._height });

    // 重置视觉粒子与状态
    this._shockwaves = [];
    this._mergeParticles = [];
    this._floatingTexts = [];
    this._readyFruitTrails = [];
    this._isDragging = false;

    if (this._engine) {
      this._engine.restart();
    }

    // 重新启动 Canvas 渲染主循环，并立即重绘首帧
    this._stopRenderLoop();
    this._lastFrameTime = Date.now();
    try {
      this._renderFrame(0.016);
    } catch (e) {}
    this._startRenderLoop();
  },

  /**
   * 返回大厅
   */
  goHome() {
    if (this._isNavigating) return;
    this._isNavigating = true;

    wx.navigateBack({
      fail: () => {
        wx.redirectTo({ url: '/pages/index/index' });
      }
    });
  }
});
