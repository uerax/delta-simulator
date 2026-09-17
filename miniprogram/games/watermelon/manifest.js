/**
 * 合成非洲之心 - 游戏元数据与配置
 * 登记至 GameRegistry，驱动大厅卡片渲染
 */

module.exports = {
  id: 'watermelon',
  title: '合成非洲之心',
  icon: '💎',
  // 官方已备案国内 CDN 非洲之心透明背景图
  iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png',
  tag: '物理消除 / 绝密红品',
  desc: '三角洲摸金版《合成非洲之心》！从含氟牙膏一路碰撞合成，冲击终极绝密大金非洲之心！',
  // 6级红品专属暗红底色与高光渐变 (严格对齐 LEVEL_THEMES[6])
  bgGradient: 'linear-gradient(135deg, rgba(224, 58, 62, 0.45) 0%, #361a1c 100%)',
  boxStyle: 'border: 2rpx solid #E03A3E; box-shadow: 0 4rpx 16rpx rgba(224, 58, 62, 0.4);',
  path: '/pages/watermelon/index',

  /**
   * 格式化大厅卡片战绩展示
   * 展示：合成非洲之心数
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    let count = 0;
    if (gameRecord) {
      if (typeof gameRecord.todayWatermelonCount === 'number') {
        count = gameRecord.todayWatermelonCount;
      } else if (typeof gameRecord.totalWatermelonCount === 'number') {
        count = gameRecord.totalWatermelonCount;
      }
    }

    return {
      label: '合成非洲之心数',
      val: `${count} 个`
    };
  }
};
