// app.js
const Storage = require('./utils/storage');
const ItemManager = require('./utils/itemManager');

App({
  onLaunch: function () {
    // 预热并初始化道具多维索引 Map
    ItemManager.init();

    // 初始化本地存储数据
    this.globalData = {
      userProfile: Storage.getUserProfile(),
      settings: Storage.getSettings()
    };
  },

  onShow: function () {
    // 切回前台时刷新全局缓存
    this.globalData.userProfile = Storage.getUserProfile();
    this.globalData.settings = Storage.getSettings();
  },

  globalData: {
    userProfile: null,
    settings: null
  }
});
