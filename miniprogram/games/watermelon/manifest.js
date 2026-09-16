/**
 * 合成大西瓜 (合成非洲之心) - 游戏元数据与配置
 * 登记至 GameRegistry，驱动大厅卡片渲染
 */

module.exports = {
  id: 'watermelon',
  title: '合成大西瓜',
  icon: '🍉',
  // 官方已备案国内 CDN 非洲之心透明背景图
  iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050006.png',
  tag: '物理消除 / 摸金',
  desc: '三角洲摸金版大西瓜！从含氟牙膏一路碰撞合成，冲击终极绝密大金非洲之心！',
  // 翠绿西瓜战术渐变与翡翠光泽
  bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.45) 0%, #064e3b 100%)',
  boxStyle: 'border: 2rpx solid #10B981; box-shadow: 0 4rpx 16rpx rgba(16, 185, 129, 0.35);',
  path: '/pages/watermelon/index',

  /**
   * 格式化大厅卡片战绩展示
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    if (gameRecord && gameRecord.bestMoney !== undefined && gameRecord.bestMoney > 0) {
      const moneyFormatted = gameRecord.bestMoneyFormatted || (gameRecord.bestMoney).toLocaleString('en-US');
      return {
        label: '最高搜刮身价',
        val: `${moneyFormatted} 金币`
      };
    }

    if (gameRecord && gameRecord.bestScore !== undefined && gameRecord.bestScore > 0) {
      return {
        label: '最高得分',
        val: `${gameRecord.bestScore} 分`
      };
    }

    return {
      label: '最高搜刮身价',
      val: '暂无战绩'
    };
  }
};
