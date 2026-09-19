/**
 * verify_user_manager.js
 * 自动化测试独立用户管理服务模块 (UserManager)
 */

const assert = require('assert');

// 模拟微信小程序环境的 wx.getStorageSync 与 wx.setStorageSync
const mockStorage = {};
global.wx = {
  getStorageSync(key) {
    return mockStorage[key] || '';
  },
  setStorageSync(key, value) {
    mockStorage[key] = value;
  },
  login(options) {
    setTimeout(() => {
      options.success({ code: 'mock_wx_code_' + Date.now() });
      if (options.complete) options.complete();
    }, 10);
  },
  checkSession(options) {
    setTimeout(() => {
      options.success();
    }, 5);
  },
  showToast(options) {
    // 模拟吐司
  }
};

const UserManager = require('../miniprogram/utils/userManager');
const Storage = require('../miniprogram/utils/storage');

async function runTests() {
  console.log('🧪 开始运行 UserManager 用户管理服务模块自动化单元测试...\n');

  // 测试用例 1: 初始化与默认值
  console.log('▶ 测试用例 1: 默认初始化与野生鼠鼠昵称断言');
  const initialUser = UserManager.init();
  assert.strictEqual(initialUser.nickName, '野生鼠鼠', '默认昵称必须为【野生鼠鼠】');
  assert.strictEqual(initialUser.avatarUrl, '/images/avatar.png', '默认头像必须为 /images/avatar.png');
  assert.strictEqual(initialUser.isLoggedIn, false, '未触发登录前 isLoggedIn 应为 false');
  assert.ok(initialUser.userId.startsWith('usr_'), 'userId 必须生成且以 usr_ 开头');
  console.log('  ✅ 通过: 默认字段正确，已绑定【野生鼠鼠】\n');

  // 测试用例 2: 登录事件与观察者派发
  console.log('▶ 测试用例 2: 登录状态机流转与观察者订阅广播');
  let loginEventFired = false;
  let changeEventFired = false;

  const onLogin = (info) => {
    loginEventFired = true;
    assert.strictEqual(info.isLoggedIn, true);
  };
  const onChange = (info, evt) => {
    changeEventFired = true;
  };

  UserManager.on('login', onLogin);
  UserManager.on('change', onChange);

  const loggedUser = await UserManager.login({ silent: true });
  assert.strictEqual(loggedUser.isLoggedIn, true, '登录后 isLoggedIn 必须为 true');
  assert.strictEqual(UserManager.isLoggedIn(), true, 'UserManager.isLoggedIn() 必须返回 true');
  assert.strictEqual(UserManager.getStatus(), UserManager.LOGIN_STATUS.LOGGED_IN, '状态机必须流转为 logged_in');
  assert.strictEqual(loginEventFired, true, 'login 事件必须触发');
  assert.strictEqual(changeEventFired, true, 'change 事件必须触发');
  console.log('  ✅ 通过: wx.login 流程成功跑通，状态机与广播均正常\n');

  // 测试用例 3: 个人资料更新 (头像与昵称)
  console.log('▶ 测试用例 3: 用户资料更新与 Storage 本地持久化同步');
  let updateEventFired = false;
  UserManager.on('update', (info) => {
    updateEventFired = true;
    assert.strictEqual(info.nickName, '全装六级鼠');
  });

  const updatedUser = UserManager.updateProfile({
    nickName: '全装六级鼠',
    avatarUrl: '/images/custom_avatar.png'
  });

  assert.strictEqual(updatedUser.nickName, '全装六级鼠');
  assert.strictEqual(updatedUser.avatarUrl, '/images/custom_avatar.png');
  assert.strictEqual(updateEventFired, true, 'update 事件必须触发');

  // 验证 Storage 存储层真实落盘
  const storedProfile = Storage.getUserProfile();
  assert.strictEqual(storedProfile.nickName, '全装六级鼠', 'Storage 必须同步更新昵称');
  assert.strictEqual(storedProfile.avatarUrl, '/images/custom_avatar.png', 'Storage 必须同步更新头像');
  console.log('  ✅ 通过: 头像与昵称更新成功，已双向同步落盘至 Storage\n');

  // 测试用例 4: 会话有效性检测 checkSession
  console.log('▶ 测试用例 4: 会话有效性检测 wx.checkSession');
  const isSessionValid = await UserManager.checkSession();
  assert.strictEqual(isSessionValid, true, 'checkSession 应当返回有效');
  console.log('  ✅ 通过: checkSession 会话检测符合预期\n');

  // 测试用例 5: 退出登录 (切换为离线游客)
  console.log('▶ 测试用例 5: 退出登录 (logout)');
  let logoutEventFired = false;
  UserManager.on('logout', (info) => {
    logoutEventFired = true;
    assert.strictEqual(info.isLoggedIn, false);
  });

  const logoutUser = UserManager.logout();
  assert.strictEqual(logoutUser.isLoggedIn, false);
  assert.strictEqual(UserManager.isLoggedIn(), false);
  assert.strictEqual(UserManager.getStatus(), UserManager.LOGIN_STATUS.UNLOGIN);
  assert.strictEqual(logoutEventFired, true, 'logout 事件必须触发');
  console.log('  ✅ 通过: 登出后平稳切换为未登录游客态\n');

  // 测试用例 6: 解绑观察者 off
  console.log('▶ 测试用例 6: 观察者解绑与内存防泄漏');
  UserManager.off('login', onLogin);
  UserManager.off('change', onChange);
  UserManager.off('update');
  UserManager.off('logout');
  assert.strictEqual(UserManager._listeners.size, 0, '所有监听器注销后 Set 大小必须为 0');
  console.log('  ✅ 通过: off 成功释放所有监听句柄\n');

  // 测试用例 7: 历史缓存脏数据“无名勇士”自愈为“野生鼠鼠”
  console.log('▶ 测试用例 7: 历史脏数据“无名勇士”自动自愈校准为“野生鼠鼠”');
  // 注入旧版脏数据
  mockStorage[Storage.STORAGE_KEYS.USER_PROFILE] = {
    userId: 'usr_old_123456',
    nickName: '无名勇士',
    avatarUrl: '/images/avatar.png',
    isLoggedIn: false
  };
  const healedProfile = Storage.getUserProfile();
  assert.strictEqual(healedProfile.nickName, '野生鼠鼠', '读取旧版“无名勇士”缓存时必须强制自愈为“野生鼠鼠”');
  // 验证是否回写落盘
  const storedAfterHeal = mockStorage[Storage.STORAGE_KEYS.USER_PROFILE];
  assert.strictEqual(storedAfterHeal.nickName, '野生鼠鼠', '自愈后的昵称必须回写更新至本地缓存');
  console.log('  ✅ 通过: 历史脏数据已 100% 自动自愈纠正并持久化\n');

  console.log('🎉 UserManager 用户模块全部 7 项单元测试 100% 绿色通过！');
}

runTests().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
