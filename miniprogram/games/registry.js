/**
 * 游戏注册中心 (Game Registry)
 * 集中管理所有小游戏的元数据、配置与大厅展示适配器
 * 遵循开闭原则 (OCP)：新增游戏只需在此数组中引入并登记
 */

const fortuneManifest = require('./fortune/manifest');
const watermelonManifest = require('./watermelon/manifest');
const reactionManifest = require('./reaction/manifest');
const schulteManifest = require('./schulte/manifest');

// 全量已注册小游戏列表（维护大厅展示顺序：1.今日鼠鼠运势 2.合成大西瓜 3.极速反应 4.舒尔特方格）
const REGISTERED_GAMES = [
  fortuneManifest,
  watermelonManifest,
  reactionManifest,
  schulteManifest
];

const GameRegistry = {
  /**
   * 获取所有注册游戏元数据列表
   */
  getAllGames() {
    return REGISTERED_GAMES;
  },

  /**
   * 按 ID 检索特定游戏元数据
   * @param {string} id
   */
  getGame(id) {
    return REGISTERED_GAMES.find(g => g.id === id) || null;
  },

  /**
   * 自动生成大厅卡片列表所需要的完整数据（动态合并统计与战绩格式化）
   * @param {object} globalStats 全局统计 (Storage.getGameStats())
   * @param {object} recordsMap 独立游戏命名空间记录表 (wx.getStorageSync('delta_game_records'))
   */
  getLobbyList(globalStats = {}, recordsMap = {}) {
    return REGISTERED_GAMES.map(game => {
      const gameRecord = recordsMap[game.id] || null;
      const record = typeof game.getLobbyRecord === 'function'
        ? game.getLobbyRecord(globalStats, gameRecord)
        : { label: '最佳战绩', val: '暂无' };

      return {
        id: game.id,
        title: game.title,
        icon: game.icon,
        iconUrl: game.iconUrl || '',
        tag: game.tag,
        desc: game.desc,
        bgGradient: game.bgGradient,
        boxStyle: game.boxStyle || '',
        path: game.path,
        recordLabel: record.label,
        recordVal: record.val
      };
    });
  }
};

module.exports = GameRegistry;
