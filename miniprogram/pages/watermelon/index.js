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

Page({
  data: {
    score: 0,
    moneyFormatted: '0',
    combo: 0,
    isWarning: false,
    nextItem: null,
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
    this._floatingTexts = []; // 连击与加分漂浮字
    this._isDragging = false;

    // 读取用户震动配置
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    this._vibrationEnabled = settings.vibrationEnabled !== false;

    // 获取画布尺寸并初始化物理引擎与主循环
    this._initCanvas();
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
    this._imgCache = {};
    this._shockwaves = [];
    this._floatingTexts = [];
    MapManager.clearCache();
  },

  /**
   * 初始化 Canvas 2D 画布
   */
  _initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        console.error('Canvas 节点获取失败');
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const width = res[0].width;
      const height = res[0].height;

      // 适配高清屏幕像素比 (Retina)
      const systemInfo = wx.getSystemInfoSync();
      const dpr = systemInfo.pixelRatio || 2;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      this._canvas = canvas;
      this._ctx = ctx;
      this._width = width;
      this._height = height;
      this._dpr = dpr;

      // 抽取本局战术地图背景切片
      MapManager.pickSession({ width, height });

      // 预加载所有品级道具的贴图图片
      this._preloadImages();

      // 创建核心引擎
      this._setupEngine(width, height);

      // 启动游戏并进入 60 FPS Canvas 渲染主循环
      this._engine.start();
      this._lastFrameTime = Date.now();
      this._startRenderLoop();
    });
  },

  /**
   * 预加载道具图片至 Canvas Image 实例缓存
   */
  _preloadImages() {
    if (!this._canvas) return;

    WATERMELON_ITEMS.forEach(item => {
      const img = this._canvas.createImage();
      img.src = item.iconUrl;
      this._imgCache[item.level] = img;
    });
  },

  /**
   * 组装逻辑引擎与事件中继
   */
  _setupEngine(width, height) {
    this._engine = new WatermelonEngine({
      width: width,
      height: height,
      dropY: 36,
      dangerY: 76,
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
        // 1. 添加合成视觉微光环 (仅在刚体边缘闪现微弱光圈)
        this._shockwaves.push({
          x: spawnX,
          y: spawnY,
          radius: item.radius * 0.85,
          maxRadius: item.radius * 1.2,
          color: item.colorHex,
          alpha: 0.8
        });

        // 2. 为新生成的刚体施加弹性缩放弹出动画 (Squash & Stretch)
        if (newBody) {
          newBody.popScale = 0.55;
          newBody.popDuration = 0.16; // 0.16 秒弹性回弹
          newBody.popElapsed = 0;
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

    // 初始状态挂载到界面
    const initial = this._engine.getInitialState();
    this.setData({
      nextItem: initial.nextItem,
      score: initial.score,
      moneyFormatted: initial.moneyFormatted
    });
  },

  /**
   * 启动渲染与物理驱动帧循环 (严格零 setData)
   */
  _startRenderLoop() {
    const loop = () => {
      const now = Date.now();
      const dt = (now - this._lastFrameTime) / 1000;
      this._lastFrameTime = now;

      // 1. 物理世界更新
      if (this._engine) {
        this._engine.update(dt);
      }

      // 2. 画布渲染
      this._renderFrame(dt);

      // 3. 驱动下一帧
      if (this._canvas) {
        this._rafId = this._canvas.requestAnimationFrame(loop);
      }
    };

    if (this._canvas) {
      this._rafId = this._canvas.requestAnimationFrame(loop);
    }
  },

  /**
   * 停止帧循环
   */
  _stopRenderLoop() {
    if (this._rafId && this._canvas) {
      this._canvas.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  /**
   * 渲染单帧画面
   */
  _renderFrame(dt = 0.016) {
    const ctx = this._ctx;
    const width = this._width;
    const height = this._height;
    if (!ctx || !this._engine) return;

    // 清空背景
    ctx.clearRect(0, 0, width, height);

    // 结算弹窗展示期间，完全清空画布并停止绘制小球与警戒线，物理消除模拟器同层图层遮挡
    if (this.data.showResultModal) {
      return;
    }

    // 1. 绘制战术地图背景与科技网格 (MapManager 方案B)
    MapManager.drawBackground(this._canvas, ctx, width, height, {
      maskColor: 'rgba(15, 18, 26, 0.80)',
      mapAlpha: 0.38,
      showGrid: true,
      showCrosshair: true
    });

    // 2. 绘制顶部警戒红线 (带呼吸警示虚线)
    this._drawDangerLine(ctx, width);

    // 3. 绘制顶部准星与投掷导轨
    this._drawDropperGuide(ctx, height);

    // 4. 绘制物理世界中所有小球道具 (带弹性弹出动画)
    const bodies = this._engine.physics.bodies;
    for (let i = 0; i < bodies.length; i++) {
      this._drawFruit(ctx, bodies[i], dt);
    }

    // 5. 绘制待下落的当前道具 (位于顶部准星处)
    if (this._engine.gameState === 'playing' && !this._engine.isDropping) {
      this._drawCurrentHeldFruit(ctx);
    }

    // 6. 绘制合成冲击波特效
    this._drawShockwaves(ctx);

    // 7. 绘制连击与身价浮动文字
    this._drawFloatingTexts(ctx, dt);
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
    const item = getItemByLevel(level);
    if (!item) return;

    const x = this._engine.currentFruitX;
    const y = this._engine.dropY;
    const radius = item.radius;
    const lineWidth = 2.5;

    ctx.save();
    ctx.translate(x, y);

    // 1. 绘制圆形底色
    ctx.fillStyle = item.bgColorHex;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 贴入高清道具图 (等比包含缩放，不拉伸变形，距边缘留有呼吸空隙)
    const img = this._imgCache[level];
    if (img && img.width) {
      const contentRadius = radius * 0.76;
      const maxDim = contentRadius * 2;
      let drawW = maxDim;
      let drawH = maxDim;

      if (img.height) {
        const aspect = img.width / img.height;
        if (aspect >= 1) {
          drawW = maxDim;
          drawH = maxDim / aspect;
        } else {
          drawH = maxDim;
          drawW = maxDim * aspect;
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius - lineWidth / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    // 3. 往内部绘制高亮圆环边框 (内描边，外缘严格贴合物理圆，绝不超出原本面积)
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

    // 1. 弹性弹出动画计算 (Squash & Stretch / Pop Animation)
    let scale = 1.0;
    if (body.popScale !== undefined && body.popDuration > 0) {
      body.popElapsed += dt;
      const p = body.popElapsed / body.popDuration;
      if (p < 1.0) {
        // 先快速弹性放大至 1.15，再平滑回弹至 1.0
        scale = 0.55 + 0.65 * Math.sin(p * Math.PI * 0.85);
      } else {
        delete body.popScale;
        delete body.popDuration;
        delete body.popElapsed;
      }
    }

    ctx.save();
    ctx.translate(body.x, body.y);
    if (scale !== 1.0) {
      ctx.scale(scale, scale);
    }
    ctx.rotate(body.angle); // 贴图随刚体真实旋转滚动

    const radius = body.radius;
    const lineWidth = body.level >= 9 ? 3.5 : 2; // 高阶大金加粗高光

    // 1. 圆形底色
    ctx.fillStyle = item.bgColorHex;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 贴入高清道具图 (等比包含缩放，不拉伸变形，距边缘留有呼吸空隙)
    const img = this._imgCache[body.level];
    if (img && img.width) {
      const contentRadius = radius * 0.76;
      const maxDim = contentRadius * 2;
      let drawW = maxDim;
      let drawH = maxDim;

      if (img.height) {
        const aspect = img.width / img.height;
        if (aspect >= 1) {
          drawW = maxDim;
          drawH = maxDim / aspect;
        } else {
          drawH = maxDim;
          drawW = maxDim * aspect;
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius - lineWidth / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }

    // 3. 往内部绘制品质外光圈边框 (内描边，外缘严格贴合物理圆，绝不超出原本面积)
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

    if (this._engine) {
      this._engine.restart();
    }
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
