/**
 * 舒尔特专注方格 - 游戏元数据与配置
 */

module.exports = {
  id: 'schulte',
  title: '舒尔特专注方格',
  icon: '🧠',
  tag: '注意力 / 视幅',
  desc: '4x4 随机乱序方格，按序找出 1 到 16，挑战专注极速！',
  bgGradient: 'linear-gradient(135deg, #89b4fa, #b4befe)',
  path: '/pages/schulte/index',

  /**
   * 格式化大厅卡片战绩展示
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    const bestTime = (gameRecord && gameRecord.bestTime !== undefined)
      ? gameRecord.bestTime
      : (stats.schulteBestTime || 0);

    return {
      label: '最佳用时',
      val: bestTime ? `${bestTime.toFixed(1)} 秒` : '暂无记录'
    };
  }
};
