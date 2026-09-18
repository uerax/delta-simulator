/**
 * 三角洲行动 - 战区物资管理器 (SupplyManager)
 *
 * 参考 ItemManager:
 *  - 动态从 supply_manifest.js 数据源加载数据
 *  - init() 写入 supplyMap，方便按名称 O(1) 读取
 *  - 自动拼接完整的官方 CDN 图片 URL (pic)
 */

class SupplyManagerService {
  constructor() {
    this._initialized = false;
    this.supplyMap = new Map();
    this._allSupplies = [];
    this.cdnBaseUrl = '';
  }

  /**
   * 初始化索引构建（支持在 app.js 中调用预热，具备幂等防重）
   */
  init() {
    if (this._initialized) return this;

    try {
      let data;
      try {
        data = require('@/assets/supplies/supply_manifest.js');
      } catch (e) {
        data = require('../assets/supplies/supply_manifest.js');
      }

      const rawList = Array.isArray(data) ? data : (data.items || []);
      const cdnBase = data.cdnBaseUrl || '';
      this.cdnBaseUrl = cdnBase;

      const processed = [];

      for (let i = 0; i < rawList.length; i++) {
        const raw = rawList[i];
        const name = raw.name;
        const color = raw.color || 'default';
        const fileName = raw.pic || '';
        const fullPicUrl = fileName.startsWith('http') ? fileName : (cdnBase + fileName);

        const supply = {
          name: name,
          color: color,
          pic: fullPicUrl,
          fileName: fileName
        };

        processed.push(supply);

        // 写入 Map: 支持按名称直接 O(1) 检索
        if (name) {
          this.supplyMap.set(name, supply);
        }
      }

      this._allSupplies = processed;
      this._initialized = true;
    } catch (e) {
      console.error('[SupplyManager] 初始化失败:', e);
    }

    return this;
  }

  _ensureInit() {
    if (!this._initialized) {
      this.init();
    }
  }

  /**
   * 按名称获取物资
   * @param {string} name 物资名称 (如 '保险箱')
   * @returns {Object|null}
   */
  getByName(name) {
    this._ensureInit();
    return this.supplyMap.get(name) || null;
  }

  /**
   * 获取全量物资列表
   * @returns {Array<Object>}
   */
  getAll() {
    this._ensureInit();
    return this._allSupplies;
  }
}

module.exports = new SupplyManagerService();
