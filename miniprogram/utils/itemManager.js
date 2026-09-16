/**
 * 三角洲行动 - 道具管理器 (ItemManager)
 *
 * 核心架构:
 *  1. 等级颜色与视觉主题枚举 (LEVEL_THEMES, 1~6 级)
 *  2. 全局双键索引 Map (itemMap: 支持按 id 与 name 检索)
 *  3. 1~6 级专属双键 Map (level1Map ~ level6Map: 支持按 id 与 name 检索)
 *  4. 1~6 级专属有序数组池 (level1List ~ level6List: 按身价降序)
 *  5. 道具内置衍生字段:
 *     - item.priceFormatted: 千分位金额字符串 (如 "13,141,314")
 *     - item.theme: 对应的等级主题视觉配置 ({ level, name, colorHex, bgColor, bgGradient })
 */

// 1. 等级主题与视觉颜色枚举 (1~6 级)
const LEVEL_THEMES = Object.freeze({
  1: Object.freeze({
    level: 1,
    name: '1级·白',
    colorHex: '#9CA3AF',
    bgColor: '#1e2222',
    bgGradient: 'linear-gradient(135deg, rgba(156, 163, 175, 0.35) 0%, #1e2222 100%)'
  }),
  2: Object.freeze({
    level: 2,
    name: '2级·绿',
    colorHex: '#10B981',
    bgColor: '#10211a',
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, #10211a 100%)'
  }),
  3: Object.freeze({
    level: 3,
    name: '3级·蓝',
    colorHex: '#2563EB',
    bgColor: '#121f28',
    bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.35) 0%, #121f28 100%)'
  }),
  4: Object.freeze({
    level: 4,
    name: '4级·紫',
    colorHex: '#9333EA',
    bgColor: '#1e1c2c',
    bgGradient: 'linear-gradient(135deg, rgba(147, 51, 234, 0.35) 0%, #1e1c2c 100%)'
  }),
  5: Object.freeze({
    level: 5,
    name: '5级·橙',
    colorHex: '#F59E0B',
    bgColor: '#37281b',
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.35) 0%, #37281b 100%)'
  }),
  6: Object.freeze({
    level: 6,
    name: '6级·红',
    colorHex: '#E03A3E',
    bgColor: '#361a1c',
    bgGradient: 'linear-gradient(135deg, rgba(224, 58, 62, 0.45) 0%, #361a1c 100%)'
  })
});

/**
 * 格式化千分位金额
 * @param {number} num
 * @returns {string} 如 "13,141,314"
 */
function formatPrice(num) {
  if (!num || isNaN(num)) return '0';
  return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

class ItemManagerService {
  constructor() {
    this._initialized = false;

    // 等级枚举挂载
    this.LEVEL_THEMES = LEVEL_THEMES;

    // 全局双键索引 Map (支持 ID 和 Name 双向查)
    this.itemMap = new Map();

    // 1~6 级专属双键 Map (方案 A: 支持 ID 和 Name 双向查)
    this.level1Map = new Map();
    this.level2Map = new Map();
    this.level3Map = new Map();
    this.level4Map = new Map();
    this.level5Map = new Map();
    this.level6Map = new Map();

    // 1~6 级专属列表 (按价格降序)
    this.level1List = [];
    this.level2List = [];
    this.level3List = [];
    this.level4List = [];
    this.level5List = [];
    this.level6List = [];

    // 等级容器映射字典
    this.levelMaps = {
      1: this.level1Map,
      2: this.level2Map,
      3: this.level3Map,
      4: this.level4Map,
      5: this.level5Map,
      6: this.level6Map
    };

    this.levelLists = {
      1: this.level1List,
      2: this.level2List,
      3: this.level3List,
      4: this.level4List,
      5: this.level5List,
      6: this.level6List
    };

    // 全量道具只读数组缓存
    this._allItems = [];

    // CDN 基础前缀
    this.cdnBaseUrl = 'https://playerhub.df.qq.com/playerhub/60004/object/';
  }

  /**
   * 初始化索引构建（支持在 app.js 中调用预热，具备幂等防重）
   */
  init() {
    if (this._initialized) return this;

    try {
      const manifest = require('../assets/items/item_manifest.json');
      const rawList = Array.isArray(manifest) ? manifest : (manifest.items || []);
      const cdnBase = manifest.cdnBaseUrl || this.cdnBaseUrl;
      this.cdnBaseUrl = cdnBase;

      const processedItems = [];

      for (let i = 0; i < rawList.length; i++) {
        const raw = rawList[i];
        const id = raw.id;
        const name = raw.name;
        const level = Number(raw.level) || 1;
        const price = Number(raw.price) || 0;
        const fileName = raw.pic || `${id}.png`;
        const fullPicUrl = fileName.startsWith('http') ? fileName : (cdnBase + fileName);

        // 构建挂载了衍生字段的标准化道具对象
        const item = {
          id: id,
          level: level,
          name: name,
          pic: fullPicUrl,
          fileName: fileName,
          price: price,
          length: Number(raw.length),
          width: Number(raw.width),
          priceFormatted: formatPrice(price),
          theme: LEVEL_THEMES[level] || LEVEL_THEMES[1]
        };

        processedItems.push(item);

        // 1. 全局双键登记
        this.itemMap.set(id, item);
        this.itemMap.set(String(id), item);
        if (name) this.itemMap.set(name, item);

        // 2. 1~6 级专属双键登记 (方案 A)
        const targetMap = this.levelMaps[level];
        const targetList = this.levelLists[level];

        if (targetMap) {
          targetMap.set(id, item);
          targetMap.set(String(id), item);
          if (name) targetMap.set(name, item);
        }

        if (targetList) {
          targetList.push(item);
        }
      }

      // 各等级数组池统一按价格降序排列
      for (let lvl = 1; lvl <= 6; lvl++) {
        this.levelLists[lvl].sort((a, b) => b.price - a.price);
      }

      // 全量数组按等级降序、再按价格降序排列
      processedItems.sort((a, b) => b.level - a.level || b.price - a.price);
      this._allItems = processedItems;

      this._initialized = true;
    } catch (err) {
      console.error('[ItemManager] 初始化失败:', err);
    }

    return this;
  }

  /**
   * 确保已初始化 (自愈防呆)
   */
  _ensureInit() {
    if (!this._initialized) {
      this.init();
    }
  }

  /**
   * 获取指定等级的主题配置
   * @param {number} level 等级 1~6
   * @returns {Object} 主题配置对象
   */
  getLevelTheme(level) {
    return LEVEL_THEMES[level] || LEVEL_THEMES[1];
  }

  /**
   * 快捷获取指定等级的背景颜色
   * @param {number} level 等级 1~6
   * @returns {string} HEX 颜色值
   */
  getBgColor(level) {
    const theme = this.getLevelTheme(level);
    return theme ? theme.bgColor : '#1e2222';
  }

  /**
   * 快捷获取指定等级的背景渐变
   * @param {number} level 等级 1~6
   * @returns {string} 渐变 CSS
   */
  getBgGradient(level) {
    const theme = this.getLevelTheme(level);
    return theme ? theme.bgGradient : '';
  }

  /**
   * O(1) 按 ID 检索道具
   * @param {number|string} id
   * @returns {Object|null}
   */
  getById(id) {
    this._ensureInit();
    return this.itemMap.get(id) || this.itemMap.get(Number(id)) || null;
  }

  /**
   * O(1) 按中文名称检索道具
   * @param {string} name
   * @returns {Object|null}
   */
  getByName(name) {
    this._ensureInit();
    return this.itemMap.get(name) || null;
  }

  /**
   * 获取指定等级的专属双键 Map (方案 A)
   * @param {number} level 1~6
   * @returns {Map<any, Object>}
   */
  getLevelMap(level) {
    this._ensureInit();
    return this.levelMaps[level] || null;
  }

  /**
   * 获取指定等级的全部道具列表 (已按身价从高到低排序)
   * @param {number} level 1~6
   * @returns {Array<Object>}
   */
  getLevelList(level) {
    this._ensureInit();
    return this.levelLists[level] || [];
  }

  /**
   * 别名方法: 按等级获取道具列表
   */
  getItemsByLevel(level) {
    return this.getLevelList(level);
  }

  /**
   * 从指定等级的道具池中随机抽取一件道具
   * @param {number} level 1~6
   * @returns {Object|null}
   */
  getRandomByLevel(level) {
    const pool = this.getLevelList(level);
    if (!pool || pool.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
  }

  /**
   * 获取全量道具数组 (474 件)
   * @returns {Array<Object>}
   */
  getAll() {
    this._ensureInit();
    return this._allItems;
  }

  /**
   * 别名方法: 获取全量道具数组
   */
  getAllItems() {
    return this.getAll();
  }
}

// 导出单例以及主题枚举
const instance = new ItemManagerService();
instance.LEVEL_THEMES = LEVEL_THEMES;

module.exports = instance;
