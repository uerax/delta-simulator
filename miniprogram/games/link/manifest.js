/**
 * 鼠鼠连连看 - 游戏元数据与配置
 * 登记至 GameRegistry，驱动大厅卡片渲染
 */

module.exports = {
  id: 'link',
  title: '鼠鼠连连看',
  icon: '🫁',
  // 官方已备案国内 CDN 6级红品复苏呼吸机透明背景图
  iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050097.png',
  tag: '战术连线 / 无限撤离',
  desc: '三角洲特勤连连看！消除相同战术物资，规划撤离路线，争分夺秒完成全区搜刮！',
  // 6级红品专属暗红底色与高光渐变 (严格对齐 LEVEL_THEMES[6])
  bgGradient: 'linear-gradient(135deg, rgba(224, 58, 62, 0.45) 0%, #361a1c 100%)',
  boxStyle: 'border: 2rpx solid #E03A3E; box-shadow: 0 4rpx 16rpx rgba(224, 58, 62, 0.4);',
  path: '/pages/link/index',

  /**
   * 格式化大厅卡片战绩展示
   * 展示：最高通关关卡数 (若未通关则展示最高积分)
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    let maxStage = 0;
    if (gameRecord) {
      if (typeof gameRecord.maxStageCleared === 'number') {
        maxStage = gameRecord.maxStageCleared;
      } else if (typeof gameRecord.bestStage === 'number') {
        maxStage = gameRecord.bestStage;
      }
    }

    return {
      label: '最高通关',
      val: `${maxStage} 关`
    };
  }
};
