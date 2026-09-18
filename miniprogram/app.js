// app.js
const Storage = require('./utils/storage');
const ItemManager = require('./utils/itemManager');
const SupplyManager = require('./utils/supplyManager');
const UserManager = require('./utils/userManager');

App({
  onLaunch: function () {
    // 预热并初始化道具与物资多维索引 Map 及用户管理服务
    ItemManager.init();
    SupplyManager.init();
    UserManager.init();

    // 初始化本地存储数据
    this.globalData = {
      userProfile: UserManager.getUserInfo(),
      settings: Storage.getSettings()
    };

    // 避峰静默预热：在小程序启动空闲时预载入物理引擎，提前建立 V8 模块缓存，消除首次进大西瓜的 290KB 解析卡顿
    setTimeout(() => {
      try {
        require('./lib/planck.min.js');
      } catch (e) {
        // 静默预热容错
      }
    }, 200);
  },

  onShow: function () {
    // 切回前台时刷新全局缓存
    this.globalData.userProfile = UserManager.getUserInfo();
    this.globalData.settings = Storage.getSettings();
  },

  globalData: {
    userProfile: null,
    settings: null
  }
});
