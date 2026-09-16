/**
 * 今日鼠鼠运势 - 游戏元数据与配置
 * 采用官方 CDN 非洲之心高清图片与 6级红品暗红专属底色
 */

module.exports = {
  id: 'fortune',
  title: '今日鼠鼠运势',
  icon: '💎',
  // 官方已备案国内 CDN 非洲之心透明背景图
  iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png',
  tag: '绝密红品 / 运势',
  desc: '每日一测，抽取专属鼠鼠运势与今日摸金逃跑指南！',
  // 6级红品专属暗红底色与高光渐变
  bgGradient: 'linear-gradient(135deg, rgba(224, 58, 62, 0.45) 0%, #361a1c 100%)',
  boxStyle: 'border: 2rpx solid #E03A3E; box-shadow: 0 4rpx 16rpx rgba(224, 58, 62, 0.4);',
  path: '/pages/fortune/index',

  /**
   * 格式化大厅卡片战绩展示
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    const todayFortune = (gameRecord && gameRecord.todayFortune)
      ? gameRecord.todayFortune
      : '待占卜';

    return {
      label: '今日运势',
      val: todayFortune
    };
  }
};
