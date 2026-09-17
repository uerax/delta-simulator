/**
 * 极速反应挑战 - 游戏元数据与配置
 */

module.exports = {
  id: 'reaction',
  title: '极速反应挑战',
  hidden: true,
  icon: '⚡',
  tag: '手速 / 敏捷',
  desc: '30秒九宫格动态打靶，考验极限反应与连击手速！',
  bgGradient: 'linear-gradient(135deg, #f38ba8, #fab387)',
  path: '/pages/game/index',

  /**
   * 格式化大厅卡片战绩展示
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    const bestScore = (gameRecord && gameRecord.bestScore !== undefined)
      ? gameRecord.bestScore
      : (stats.highScore || 0);

    return {
      label: '最高得分',
      val: `${bestScore} 分`
    };
  }
};
