/**
 * 三角洲行动 - 战术地图与游戏背景管理器 (MapManager)
 *
 * 核心设计:
 *  1. 地图注册与双键检索 (mapMap: 支持 key 'daba' 与 name '零号大坝' O(1) 检索)
 *  2. 战术背景会话 (pickSession: 纯云端官方 CDN 切片/底图随机选取与视窗计算)
 *  3. Canvas 2D 独立渲染适配 (drawBackground: 自动图象缓存、暗调色罩与战术参考刻度)
 *  4. WXML / DOM 样式生成 (getRandomBackgroundStyle: 供非 Canvas 小游戏一键调用)
 */

// 安全加载地图清单 (纯标准 CommonJS 模块，严禁直接 require json 文件以防打包器报错)
let mapManifest = [];
try {
  const loaded = require('../assets/maps/map_manifest.js');
  mapManifest = Array.isArray(loaded) ? loaded : (loaded && loaded.default) ? loaded.default : [];
} catch (e) {
  console.warn('MapManager: Failed to load map_manifest.js, fallback to empty array:', e);
  mapManifest = [];
}

class MapManagerService {
  constructor() {
    this._initialized = false;
    this.mapList = [];
    this.mapMap = new Map();
    this._imageCache = new Map(); // url -> { img, loaded, error }
    this._currentSession = null;

    this.init();
  }

  /**
   * 初始化地图索引
   */
  init() {
    if (this._initialized) return;

    const list = Array.isArray(mapManifest) ? mapManifest : [];
    this.mapList = list;
    for (const item of this.mapList) {
      if (!item) continue;
      // 冻结保护并建立双键索引
      const frozenItem = Object.freeze({ ...item });
      if (item.key) this.mapMap.set(item.key, frozenItem);
      if (item.name) this.mapMap.set(item.name, frozenItem);
    }

    this._initialized = true;
  }

  /**
   * 获取全量地图列表
   * @returns {Array<Object>}
   */
  getAllMaps() {
    this.init();
    return this.mapList;
  }

  /**
   * 按 key 或中文名称检索地图
   * @param {string} keyOrName 例如 'daba' 或 '零号大坝'
   * @returns {Object|null}
   */
  getMap(keyOrName) {
    this.init();
    return this.mapMap.get(keyOrName) || null;
  }

  /**
   * 随机抽取一张地图
   * @returns {Object}
   */
  getRandomMap() {
    this.init();
    if (!this.mapList.length) return null;
    const idx = Math.floor(Math.random() * this.mapList.length);
    return this.mapList[idx];
  }

  /**
   * 随机获取指定地图或任意地图的单个 CDN 切片 URL
   * @param {string|Object} [mapOrKey] 可选地图对象或 key，不传则全量地图随机
   * @returns {{ map: Object, tileUrl: string, tileIndex: number }}
   */
  getRandomTile(mapOrKey) {
    this.init();
    let map = null;
    if (typeof mapOrKey === 'string') {
      map = this.getMap(mapOrKey);
    } else if (mapOrKey && mapOrKey.tileUrls) {
      map = mapOrKey;
    }
    if (!map) {
      map = this.getRandomMap();
    }
    if (!map || !map.tileUrls || !map.tileUrls.length) {
      return null;
    }

    const tileIndex = Math.floor(Math.random() * map.tileUrls.length);
    const tileUrl = map.tileUrls[tileIndex];

    return { map, tileUrl, tileIndex };
  }

  /**
   * 开局选取一个独立的战术背景会话 (Session)
   * 支持指定地图，或自动在 6 大地图的 96 张官方战术切片中随机抽选
   *
   * @param {Object} [options]
   * @param {string} [options.mapKey] 可选指定地图 key
   * @param {number} [options.width] 视口宽度
   * @param {number} [options.height] 视口高度
   * @returns {Object} 当前会话背景信息
   */
  pickSession(options = {}) {
    const tileInfo = this.getRandomTile(options.mapKey);
    if (!tileInfo) return null;

    const { map, tileUrl, tileIndex } = tileInfo;

    // 计算切片所在网格坐标 (4x4, z=2, x=0~3, y=0~3)
    const gridX = Math.floor(tileIndex / 4);
    const gridY = tileIndex % 4;

    this._currentSession = {
      map,
      mapKey: map.key,
      mapName: map.name,
      tileUrl,
      tileIndex,
      gridCoord: { x: gridX, y: gridY },
      timestamp: Date.now()
    };

    return this._currentSession;
  }

  /**
   * 获取当前活动的对局背景会话
   * @returns {Object|null}
   */
  getCurrentSession() {
    return this._currentSession;
  }

  /**
   * 在 Canvas 2D 上下文中绘制战术背景 (方案 B 核心 API)
   * 支持小游戏每帧高效调用，内部自动接管图片内存缓存与加载状态
   *
   * @param {Object} canvas 微信小程序 Canvas 节点实例 (需具备 createImage 方法)
   * @param {Object} ctx Canvas 2D 绘图上下文
   * @param {number} width 画布逻辑宽度
   * @param {number} height 画布逻辑高度
   * @param {Object} [options] 配置项
   * @param {string} [options.maskColor] 战术深色遮罩 (默认 'rgba(15, 18, 26, 0.78)')
   * @param {number} [options.mapAlpha] 地图层不透明度 (默认 0.40)
   * @param {boolean} [options.showGrid] 是否叠加战术网格 (默认 true)
   * @param {boolean} [options.showCrosshair] 是否叠加中心与角标战术参考刻度 (默认 true)
   */
  drawBackground(canvas, ctx, width, height, options = {}) {
    if (!ctx || !width || !height) return;

    const maskColor = options.maskColor || 'rgba(15, 18, 26, 0.78)';
    const mapAlpha = options.mapAlpha !== undefined ? options.mapAlpha : 0.40;
    const showGrid = options.showGrid !== false;
    const showCrosshair = options.showCrosshair !== false;

    // 1. 若尚未生成当前 session，立即初始化一个
    if (!this._currentSession) {
      this.pickSession({ width, height });
    }

    const session = this._currentSession;

    try {
      // 2. 绘制深色战术底色 (兜底防白屏，渐变质感)
      ctx.save();
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#10121a');
      bgGrad.addColorStop(1, '#161922');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // 3. 异步获取/预加载当前切片图片实例
      if (session && session.tileUrl && canvas && typeof canvas.createImage === 'function') {
        const url = session.tileUrl;
        let cacheItem = this._imageCache.get(url);

        if (!cacheItem) {
          const img = canvas.createImage();
          cacheItem = { img, loaded: false, error: false };
          this._imageCache.set(url, cacheItem);

          img.onload = () => {
            cacheItem.loaded = true;
          };
          img.onerror = () => {
            cacheItem.error = true;
          };
          img.src = url;
        }

        // 4. 若图片已就绪且具备真实尺寸，以等比适应拉伸绘制到整个背景层
        if (cacheItem.loaded && !cacheItem.error && cacheItem.img && cacheItem.img.width > 0 && cacheItem.img.height > 0) {
          try {
            ctx.save();
            ctx.globalAlpha = mapAlpha;
            ctx.drawImage(cacheItem.img, 0, 0, width, height);
            ctx.restore();
          } catch (e) {
            // 忽略偶发贴图跨域或未完成解码异常
          }
        }
      }

      // 5. 绘制战术深色遮罩 (让地图退居氛围层，保证前景游戏主体清晰)
      ctx.save();
      ctx.fillStyle = maskColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // 6. 叠加战术参考经纬网格 (极度轻量，线条透明度极低)
      if (showGrid) {
        this._drawTacticalGrid(ctx, width, height);
      }

      // 7. 叠加四角战术标尺与微十字刻度 (军事沉浸感)
      if (showCrosshair) {
        this._drawTacticalCrosshair(ctx, width, height);
      }
    } catch (err) {
      // 极值容错：保证背景层任何绘制异常不向上传递打崩游戏主循环
      console.warn('MapManager.drawBackground safe caught:', err);
    }
  }

  /**
   * 绘制轻量战术网格
   * @private
   */
  _drawTacticalGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.028)';
    ctx.lineWidth = 1;

    const step = 48;
    // 纵线
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    // 横线
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 绘制四角战术角标与中心微十字
   * @private
   */
  _drawTacticalCrosshair(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.18)'; // 战术青色微光
    ctx.lineWidth = 1.5;

    const cornerSize = 12;
    const margin = 16;

    // 左上
    ctx.beginPath();
    ctx.moveTo(margin, margin + cornerSize);
    ctx.lineTo(margin, margin);
    ctx.lineTo(margin + cornerSize, margin);
    ctx.stroke();

    // 右上
    ctx.beginPath();
    ctx.moveTo(width - margin - cornerSize, margin);
    ctx.lineTo(width - margin, margin);
    ctx.lineTo(width - margin, margin + cornerSize);
    ctx.stroke();

    // 左下
    ctx.beginPath();
    ctx.moveTo(margin, height - margin - cornerSize);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(margin + cornerSize, height - margin);
    ctx.stroke();

    // 右下
    ctx.beginPath();
    ctx.moveTo(width - margin - cornerSize, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.lineTo(width - margin, height - margin - cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 为普通 WXML/DOM 页面生成随机背景 CSS 样式 (供方案 A 或普通游戏调用)
   *
   * @param {Object} [options]
   * @param {string} [options.mapKey] 可选指定地图
   * @param {string} [options.maskColor] 遮罩颜色 (默认 'rgba(15, 18, 26, 0.82)')
   * @returns {string} 可直接绑定至 style="{{mapBgStyle}}" 的 CSS 字符串
   */
  getRandomBackgroundStyle(options = {}) {
    const tile = this.getRandomTile(options.mapKey);
    const mask = options.maskColor || 'rgba(15, 18, 26, 0.82)';

    if (!tile) {
      return `background: ${mask};`;
    }

    return `background-image: linear-gradient(${mask}, ${mask}), url('${tile.tileUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;`;
  }

  /**
   * 清理图片缓存 (页面卸载时可调用)
   */
  clearCache() {
    this._imageCache.clear();
    this._currentSession = null;
  }
}

const MapManager = new MapManagerService();
module.exports = MapManager;
