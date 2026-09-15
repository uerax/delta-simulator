# 微信小程序开发框架与问题排查手册

> 本文档整理自微信官方文档 [Mini Program Framework](https://developers.weixin.qq.com/miniprogram/dev/framework/)，针对小程序双线程机制、生命周期、本地数据流及常见问题排查提供速查指南。

---

## 一、 核心架构与运行机制

### 1. 双线程模型（Double-Thread Architecture）
小程序不同于普通 Web 单线程模型，它分为两个独立的线程：
- **逻辑层（App Service）**：运行在独立的 JavaScriptCore / V8 引擎中，执行 JavaScript 逻辑代码，没有 DOM / BOM API（无法使用 `window`, `document`, `location` 等）。
- **视图层（View Layer）**：多个 WebView 线程负责 WXML 渲染、WXSS 样式布局和用户交互。
- **线程通信（JSBridge）**：
  - 视图层将用户事件（点击、滚动等）通过系统 native 层转发给逻辑层。
  - 逻辑层通过 `this.setData()` 将数据包装后通过 native 层传递给视图层引发 DOM 差异更新。
  - **性能关键**：频繁跨线程通信或单次传输超大数据（超 1MB）会导致严重掉帧或输入延迟。

### 2. 运行时与更新机制
- **冷启动（Cold Launch）**：用户首次打开或被微信后台销毁后重新打开，加载代码包并触发 `App.onLaunch`。
- **热启动（Hot Launch）**：小程序退到后台（按 Home 键或切回聊天），后台保留存活（通常维持约 5 分钟），再次切回时触发 `App.onShow`，不走 `onLaunch`。
- **更新机制**：微信定期检测新版本。开发中可通过 `wx.getUpdateManager()` 监听并强制更新。

---

## 二、 生命周期全景速查

### 1. 应用生命周期（`App`）
定义于 `app.js`：
| 钩子 | 触发时机 | 常见用途 |
| :--- | :--- | :--- |
| `onLaunch(options)` | 小程序冷启动完成 | 读取本地缓存、初始化用户状态、获取启动参数 `scene` |
| `onShow(options)` | 启动或从后台切回前台 | 恢复游戏暂停状态、检查更新、刷新前台数据 |
| `onHide()` | 从前台切回后台 | 暂停游戏主循环、停止背景音乐、自动保存进度到本地 |
| `onError(msg)` | 脚本错误或 API 调用报错 | 全局错误捕获、本地异常日志留存 |

### 2. 页面生命周期（`Page`）
定义于各个页面 `index.js`：
| 钩子 | 触发时机 | 常见用途与注意事项 |
| :--- | :--- | :--- |
| `onLoad(query)` | 页面首次加载 | 接收上个页面的路由参数 `query`，只触发 1 次 |
| `onShow()` | 页面展示 / 从下一级页面返回 | 刷新页面数据、更新最新分数与金币 |
| `onReady()` | 页面初次渲染完成 | DOM 准备完毕，可安全调用 `wx.createSelectorQuery`、初始化 Canvas |
| `onHide()` | 当前页跳转到新页面（`navigateTo`） | 暂停当前页动画或倒计时 |
| `onUnload()` | 页面关闭销毁（`navigateBack` / `redirectTo`） | 清理 `setInterval` 计时器、释放音频实例 |

> **时序注意**：`App.onLaunch` 与首个页面的 `Page.onLoad` 是异步并发的，不能假设 `Page.onLoad` 执行时 `App.onLaunch` 中的异步操作已经完成。

### 3. 组件生命周期（`Component`）
定义于自定义组件内部的 `lifetimes` 字段中：
- `created`：组件实例刚被创建，**不能在此调用 `setData`**。
- `attached`：组件实例进入页面节点树，绝大多数初始化逻辑应在此进行。
- `ready`：组件布局完成。
- `detached`：组件从节点树移除，必须在此清理定时器和监听。

---

## 三、 视图层渲染与交互机制

### 1. 条件渲染与列表渲染
- `wx:if` vs `hidden`：
  - `wx:if` 切换时是**节点的真实创建/销毁**，适合条件不经常变化的场景；
  - `hidden` 仅仅是 CSS `display: none`，适合频繁切换显隐（如游戏弹窗、暂停面板）。
- `wx:key` 规范：
  - 列表渲染必须带 `wx:key`，避免全量重绘；对于静态不变列表可用 `*this`，动态数据优先使用唯一 `id`。

### 2. 事件系统
- **事件绑定**：
  - `bindtap`：冒泡事件，点击后会向上层父容器传递。
  - `catchtap`：阻止冒泡，适合弹窗内部点击、按钮防穿透。
- **事件对象传参**：
  - `e.currentTarget.dataset`：捕获**绑定该事件的组件**上的 `data-*` 属性（推荐）。
  - `e.target.dataset`：捕获**真正触发点击的源节点**上的 `data-*`（当按钮内嵌套子元素时容易产生歧义）。

---

## 四、 本地数据存储（离线单机核心）

针对纯离线单机应用，数据流全部基于本地 Storage：

### 1. 核心 API
| 同步接口（推荐，简单直观） | 异步接口（适合耗时写入） | 说明 |
| :--- | :--- | :--- |
| `wx.setStorageSync(key, value)` | `wx.setStorage({ key, data })` | 存入数据，支持直接存 Object/Array，自动序列化 |
| `wx.getStorageSync(key)` | `wx.getStorage({ key })` | 读取数据，若不存在返回 `""`（空字符串） |
| `wx.removeStorageSync(key)` | `wx.removeStorage({ key })` | 移除指定 key |
| `wx.clearStorageSync()` | `wx.clearStorage()` | 清空本小程序的所有本地缓存 |
| `wx.getStorageInfoSync()` | `wx.getStorageInfo()` | 获取当前已用空间（KB）和所有 key 列表 |

### 2. 限制与健壮性规范
1. **容量限制**：
   - 单个小程序总上限 **10MB**。
   - 单个 key 存储数据上限 **1MB**。
2. **容错处理**：
   - `wx.setStorageSync` 在磁盘满或极端情况下会抛出异常，**必须使用 try-catch 包裹**：
   ```javascript
   try {
     wx.setStorageSync('player_data', data);
   } catch (e) {
     console.error('保存本地数据失败:', e);
   }
   ```
3. **默认值防御**：
   - 读取未初始化的 key 时，微信返回空字符串 `""`，而不是 `null` 或 `undefined`。判断时建议：
   ```javascript
   const data = wx.getStorageSync('key');
   const result = (data !== '' && data !== null) ? data : defaultValue;
   ```

---

## 五、 离线小游戏常用原生能力

### 1. 触感与震动
在按键、碰撞、达成成就时提供物理反馈：
```javascript
// 短震动（轻微震动，适合按钮点击、击中反馈，15ms）
wx.vibrateShort({ type: 'light' }); // 'heavy' | 'medium' | 'light'

// 长震动（明显震动，400ms，适合游戏失败、通关）
wx.vibrateLong();
```

### 2. 音效与背景音乐
创建内部音频上下文：
```javascript
const audio = wx.createInnerAudioContext();
audio.src = '/audio/click.mp3';
audio.play();

// 必须在页面 onUnload 时销毁
audio.destroy();
```

### 3. 用户简易信息收集（合规离线方案）
自微信隐私保护指引更新后，推荐使用原生组件获取头像和昵称保存在本地：
```html
<!-- 头像选择 -->
<button open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">
  <image src="{{avatarUrl}}" />
</button>

<!-- 昵称输入 -->
<input type="nickname" bindblur="onNicknameBlur" placeholder="请输入昵称" />
```

---

## 六、 常见问题与排查排障清单（Troubleshooting）

### 1. 页面数据显示不出来或没有响应
- **排查 `setData`**：
  - 检查是否直接 `this.data.count = 1`（错误！直接赋值无法触发视图渲染，必须通过 `this.setData({ count: 1 })`）。
  - 检查 `setData` 的 key 路径是否正确。
- **排查异步时序**：
  - 如果数据在异步回调（定时器、Promise）中，确认回调函数使用了**箭头函数**保持 `this` 指向页面实例。

### 2. 游戏卡顿、掉帧或输入延迟
- **排查频繁 `setData`**：
  - 避免在游戏循环（如 60FPS 的 `requestAnimationFrame`）中每帧调用 `setData`。
  - 对于不需要在 WXML 界面展示的变量（如内部计数器、物理坐标、游戏内部状态），**不要放在 `data` 中**，直接挂载在 `this` 实例上（例如 `this.gameTimer = null; this.score = 0;`）。
- **纯数据字段（Pure Data Fields）**：
  - 在 Component 中声明 `options: { pureDataPatterns: /^_/ }`，所有以 `_` 开头的字段不参与界面渲染通信。

### 3. 路由跳转报错 `navigate:fail`
- `navigateTo` 限制：页面栈最多深度为 **10 层**。连续跳转会崩溃。
- 解决：游戏局内重新开始或返回主页时，使用 `wx.redirectTo`（关闭当前页跳转）或 `wx.reLaunch`（清空页面栈重开）。

### 4. 样式在手机端不生效或错位
- **屏幕适配**：全面使用 `rpx` 单位（微信约定以 750 物理像素宽度为基准，在所有机型上自动等比缩放）。
- **组件样式隔离**：自定义组件内部的类名默认与页面样式隔离。如需共享，在组件 json 中配置 `"styleIsolation": "apply-shared"`。

### 5. 本地数据在不同页面不同步
- 页面切换时，后退返回上一页通常只触发 `onShow`，**不触发 `onLoad`**。
- 如果上一页需要显示最新的本地数据，**读取本地 Storage 的代码必须写在 `onShow` 钩子中**，确保每次返回前台都能读到最新数据。
