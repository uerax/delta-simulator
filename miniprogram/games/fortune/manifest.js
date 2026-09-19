/**
 * 今日鼠鼠运势 - 游戏元数据与配置
 * 采用官方 CDN 海洋之泪高清图片与 6级红品暗红专属底色
 */

const itemManager = require('../../utils/itemManager');
const { LEVEL_COPYWRITING } = require('./fortuneConfig');

module.exports = {
  id: 'fortune',
  title: '今日鼠鼠运势',
  icon: '💎',
  // 官方已备案国内 CDN 海洋之泪透明背景图
  iconUrl: 'https://playerhub.df.qq.com/playerhub/60004/object/15080050142.png',
  tag: '绝密红品 / 运势',
  desc: '每日一测，抽取专属鼠鼠运势与今日摸金逃跑指南！',
  // 6级红品专属暗红底色与高光渐变
  bgGradient: 'linear-gradient(135deg, rgba(224, 58, 62, 0.45) 0%, #361a1c 100%)',
  boxStyle: 'border: 2rpx solid #E03A3E; box-shadow: 0 4rpx 16rpx rgba(224, 58, 62, 0.4);',
  path: '/pages/fortune/index',

  /**
   * 格式化大厅卡片战绩展示 (仅展示物资名称，并直接从已有的 itemManager/LEVEL_COPYWRITING 提取品质专属字体颜色)
   * @param {object} stats 全局统计
   * @param {object} gameRecord 独立游戏记录
   */
  getLobbyRecord(stats = {}, gameRecord = {}) {
    if (!gameRecord || !gameRecord.todayFortune) {
      return {
        label: '今日运势',
        val: '待占卜',
        color: ''
      };
    }

    const rawFortune = String(gameRecord.todayFortune).trim();
    const fortuneResult = gameRecord.fortuneResult || null;

    let itemName = rawFortune;

    // 向下兼容清洗：历史残留格式形如 "小紫 · 中心贵宾室" 或 "大红 · 非洲之心"，提取纯物资名
    if (rawFortune.includes('·')) {
      itemName = rawFortune.split('·').slice(1).join('·').trim();
    }

    // 1. 优先使用运势记录自带的颜色
    let color = (fortuneResult && fortuneResult.colorHex) || gameRecord.fortuneColor || '';

    // 2. 若未直接带颜色，直接从现有的 itemManager 单例中检索该物资的权威品质主题色
    if (!color && itemName) {
      const item = itemManager.getByName(itemName);
      if (item && item.theme && item.theme.colorHex) {
        color = item.theme.colorHex;
      }
    }

    // 3. 若仍未匹配，直接从现有的 itemManager.getLevelTheme 获取该等级主题色
    const level = (fortuneResult && fortuneResult.luckyLevel) || gameRecord.fortuneLevel;
    if (!color && level) {
      const theme = itemManager.getLevelTheme(level);
      if (theme && theme.colorHex) {
        color = theme.colorHex;
      }
    }

    // 4. 若为旧文本缓存，直接从现有的 LEVEL_COPYWRITING 匹配等级颜色
    if (!color && rawFortune.includes('·')) {
      const prefix = rawFortune.split('·')[0].trim();
      const matched = Object.values(LEVEL_COPYWRITING).find(cfg => cfg.levelName === prefix || cfg.sign === prefix);
      if (matched && matched.colorHex) {
        color = matched.colorHex;
      }
    }

    return {
      label: '今日运势',
      val: itemName || '未知物资',
      color: color
    };
  }
};
