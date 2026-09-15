// app.js
const Storage = require('./utils/storage');

App({
  onLaunch: function () {
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
