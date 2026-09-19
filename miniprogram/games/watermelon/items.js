/**
 * 兼容代理：大西瓜核心已全面迁移至 pages/watermelon 独立分包
 * 保持此文件向外重导出，保障主包外自动化测试与历史引用的 100% 透明兼容
 */
module.exports = require('../../pages/watermelon/items');
