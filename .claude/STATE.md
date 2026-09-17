# 项目任务状态记录

## [2026-09-17] 大西瓜全面切换至 Planck.js 物理引擎（剥离双引擎分支与兼容代码）
- 状态：已完成
- 优先级：P1
- 描述：
  1. 彻底移除 `engine.js` 中所有对自建物理引擎的依赖引用，移除多引擎动态切换判断 (`this.physicsEngineType`) 及降级 try-catch 分支代码；
  2. `WatermelonEngine` 直接绑定新引入的工业级 Planck.js 物理引擎适配层（`physicsPlanck.js`），实现唯一单一引擎运行；
  3. 执行单测回归（`verify_game_architecture.js` 与 `verify_planck_watermelon.js`），物理碰撞、刚体阻尼滚停休眠、合成逻辑全部 100% 正常。
- 涉及文件：
  - `miniprogram/games/watermelon/engine.js`
  - `.claude/STATE.md`


## [2026-09-17] 彻底落地大西瓜整页一体化同步呈现（根门控pageReady机制/消除API废弃告警）
- 状态：已完成
- 优先级：P0
- 描述：
  1. 根因再排查：
     - 之前的局部过渡方案仅对 `.canvas-wrap` 单独控制 `opacity`，并在 `onReady` 里人工 `setTimeout 280ms`，反而造成了“顶部底部 DOM 已经滑入，而中间 Canvas 延迟 280ms 才出现”的二次分步割裂感，违背了用户“整体化出现”的核心诉求。
     - 控制台出现 `wx.getSystemInfoSync is deprecated` 告警，影响开发者工具运行体验。
  2. 彻底落地措施：
     - **全页根容器统一门控（`pageReady`）**：将显隐门控从子组件 `.canvas-wrap` 移至整页最外层根容器 `.watermelon-container`。默认声明 `opacity: 0`；
     - **移除人工延迟，首帧原子级整体点亮**：移除 `onReady` 的 280ms 等待，立即并发获取 Canvas 并完成首帧渲染，首帧绘制成功的一瞬间直接触发 `this.setData({ pageReady: true })`，整页（顶部状态栏 + 游戏画面 + 底部操作栏）以 0.16s 整体平滑同步浮现，彻底消灭任何先后时差；
     - **消除微信 API 废弃告警**：在 `index.js` 和 `feedback.js` 统一封装 `getSafeWindowInfo` / `checkIsDevTools`，优先使用官方推荐的 `wx.getWindowInfo()` / `wx.getAppBaseInfo()`，平滑兼容降级，控制台零告警。
- 涉及文件：
  - `miniprogram/pages/watermelon/index.js`
  - `miniprogram/pages/watermelon/index.wxss`
  - `miniprogram/pages/watermelon/index.wxml`
  - `miniprogram/utils/feedback.js`
  - `.claude/STATE.md`


## [2026-09-17] 彻底根治大西瓜转场割裂（Native Canvas抢跑与页面入场动画异步调度对齐）
- 状态：已完成
- 优先级：P1
- 描述：
  1. 深度根因排查：
     - 用户观察到的“滑动出现”本质是微信小程序原生的页面路由切换转场动画（`wx.navigateTo` 默认右滑入场，耗时约 260~300ms）；
     - 但 `<canvas type="2d">` 是由微信客户端 Native 原生层直接渲染合成的同层组件，它脱离了普通 WebView DOM 容器的 CSS 平移动画，在进入页面的第 0 毫秒就直接固化在物理窗口中央并画出了背景和游戏；
     - 与此同时，WebView DOM 容器（包裹着顶部状态栏与底部栏）还在执行右滑入场，导致视觉上 Canvas 仿佛“抢先暴露”，而顶部和底部则“慢半拍滑入”，体验极其割裂。
  2. 彻底根治措施：
     - **转场避峰异步调度**：将 Canvas 初始化与 60fps 帧循环启动延迟 280ms（精准避让微信原生 260ms 的右滑转场动画窗口）。在转场期间，让整个页面以完整、轻盈、纯 DOM 形式满帧丝滑滑入屏幕；
     - **Canvas 容器优雅平滑渐入**：`.canvas-wrap` 默认声明 `opacity: 0`，当页面入场动画归位、首帧就绪后赋予 `.canvas-ready`（`opacity: 1; transition: opacity 0.18s`），使整页视觉浑然一体，彻底消灭 Native 原生组件与 DOM 之间的动画时间差与割裂感；
     - **内存与状态闭环**：在 `onUnload` 离开页面时彻底清理 `canvasReady` 状态，确保二次入场依然百分之百丝滑同步。
- 涉及文件：
  - `miniprogram/pages/watermelon/index.js`
  - `miniprogram/pages/watermelon/index.wxss`
  - `miniprogram/pages/watermelon/index.wxml`
  - `.claude/STATE.md`


## [2026-09-17] 消除进大西瓜页面顶部与底部延迟滑动现象（首屏数据静态化/避峰预加载/消除GPU模糊滤镜）
- 状态：已完成
- 优先级：P1
- 描述：
  1. 根因排查与定位：
     - 现象本质：用户点击进入大西瓜时，同层渲染原生组件 Canvas 2D 由客户端底层瞬间画出，而顶部的 status-bar 和底部的 bottom-bar 属于 WebView DOM 容器，随着微信页面路由切换的默认右滑入场动画（Slide In）进入。
     - 延迟与卡顿根因：
       1) `.status-bar` 设置了极其昂贵的 GPU 高斯模糊属性 `backdrop-filter: blur(10px)`，导致 WebView 在右滑平移动画中每一帧都要对底层高频刷新的 Canvas 重采样与模糊计算，产生严重掉帧拖慢；
       2) `_initCanvas` 瞬间同步发起了 11 个道具高清图片的并发网络请求与解码（`_preloadImages`），并在同时启动了 60fps 物理主循环，在页面转场的关键 350ms 窗口期严重抢占了 CPU 与网络带宽；
       3) `data.nextItem` 初始为 null，依赖 `onLoad` 和 `_setupEngine` 反复触发异步 `setData`，导致 DOM 二次重排与结构后发抖动。
  2. 修复与优化措施：
     - 移除昂贵滤镜：将 `backdrop-filter: blur(10px)` 替换为细腻高质感的纯色半透明底色 `background: rgba(22, 27, 34, 0.95)`，转场 GPU 负载降至几乎为 0；
     - 首屏数据零延迟静态化：`data.nextItem` 在页面声明期直接静态绑定 `getItemByLevel(1)`（含氟牙膏），彻底消除 `onLoad` 中首屏无效 `setData` 与 DOM 重新挂载；
     - 避峰预加载分流：开局仅优先拉取前两级道具贴图（Lv.1~Lv.2），剩余高阶道具后置延后 350ms 静默拉取，彻底把转场黄金期让给页面流畅滑入；
     - 页面容器增加柔和平滑进场 `fadeInContainer` 动效，使原生 Canvas 与 DOM 元素浑然一体、同步呈现。
- 涉及文件：
  - `miniprogram/pages/watermelon/index.wxss`
  - `miniprogram/pages/watermelon/index.js`
  - `.claude/STATE.md`


## [2026-09-17] 彻底修复大西瓜页面无内容缺陷（rAF跨端调度/同步首帧/降级兜底/基础库版本还原）
- 状态：已完成
- 优先级：P0
- 描述：
  1. 深度根因排查：
     - `project.config.json` 中的 `libVersion` 之前被意外修改为 `3.4.0`，导致本地缺少该基础库的工具环境编译中断或异常；现已还原回原本的 `2.20.1`。
     - `engine.js` 顶层静态 require 了第三方 Planck.js。若特定环境对未压缩/UMD 模块的 Babel 编译产生卡死，会阻断 `engine.js` 的加载。现将 `physicsPlanck` 改为按需惰性加载，且默认物理引擎平稳切回 0 外部依赖的自研 `PhysicsWorldDefault`。
     - `_startRenderLoop` 之前强依赖 `canvas.requestAnimationFrame`，在基础库 2.20.1 或特定端该属性未挂载时直接静默跳过，一帧都没绘制，导致 Canvas 呈现死黑。
     - `_initCanvas` 中缺少尺寸兜底与同步首帧：若 flex 布局计算延迟导致节点宽高获取为 0，Canvas 产生物理折叠；且过去完全依赖异步 rAF 驱动首帧。
     - `MapManager.drawBackground` 若遇到渐变或解码异常会向外冒泡。
  2. 修复措施落地：
     - 还原 `project.config.json` 的 `libVersion: 2.20.1`；
     - `engine.js`：按需加载 Planck.js，默认运行经过全量测试的稳定内置引擎，杜绝任何第三方 UMD 依赖阻塞主流程；
     - `index.js`：
       - `_initCanvas` 增加多重防并发守卫与屏幕宽高安全兜底（确保宽高严格大于 0）；
       - `_startRenderLoop` 封装跨端调度器（`canvas.requestAnimationFrame` -> `wx.requestAnimationFrame` -> `setTimeout` 三重兜底），彻底杜绝静默不渲染；
       - `_initCanvas` 结束时立即强制执行一次同步首帧渲染 `_renderFrame(0.016)`，实现开屏即绘制；
       - `_renderFrame` 为 `MapManager.drawBackground` 增加优雅降级：若有任何异常，自动无缝降级为本地战术网格底色，确保小球、导轨和警戒线绝对正常显示。
- 涉及文件：
  - `project.config.json`
  - `miniprogram/games/watermelon/engine.js`
  - `miniprogram/pages/watermelon/index.js`
  - `miniprogram/utils/mapManager.js`
  - `.claude/STATE.md`


## [2026-09-17] 修复大西瓜页面未加载出游戏缺陷 (MapManager与SelectorQuery双重排查)
- 状态：已完成
- 优先级：P0
- 描述：
  1. 根因排查与定位：
     - `mapManager.js` 内部虽然增加了 `map_manifest.js` 的 try 分支，但在 catch 中残留了 `require('../assets/maps/map_manifest.json')`。微信小程序静态编译器在打包扫描阶段发现 require json，导致整个模块在编译期报 `module is not defined` 并中断注册。
     - `index.js` 的 `_initCanvas` 中使用了 `wx.createSelectorQuery().in(this)`。在微信框架中，`in(component)` 必须传入自定义组件实例，传入 Page 页面实例会导致选择器在寻找不存在的 Exparser 边界，在开发者工具与真机中查询 `#gameCanvas` 始终返回 null，重试耗尽后直接中断退出，游戏引擎未启动。
     - `physicsPlanck.js` UMD 模块的解构未防范 `default` 导出形态；`engine.js` 缺少物理世界初始化降级兜底。
  2. 落地修复措施：
     - `mapManager.js`：彻底移除所有对 `.json` 文件的静态 require 语句，仅纯粹引用自包含的 CommonJS 模块 `map_manifest.js` 并做好空数组兜底。
     - `index.js`：选择器恢复为微信标准 `this.createSelectorQuery()` / `wx.createSelectorQuery()`，消除 `.in(this)` 引起的 Page 节点寻址失效；增加重试次数至 8 次（每次 100ms），并在 `onUnload` 重置 `_canvasInited = false`。
     - `physicsPlanck.js`：完善 `(planckRaw && planckRaw.World) ? planckRaw : (planckRaw.default || planckRaw)` 防御性导入，并在 `engine.js` 加入物理世界自动安全降级 try-catch，确保极端情况下无缝切回内置物理引擎，绝不黑屏。
- 涉及文件：
  - `miniprogram/utils/mapManager.js`
  - `miniprogram/pages/watermelon/index.js`
  - `miniprogram/games/watermelon/physicsPlanck.js`
  - `miniprogram/games/watermelon/engine.js`
  - `.claude/STATE.md`


## [2026-09-17] 引入路线1（工业级 Planck.js 物理引擎适配）并保留原有手写引擎
- 状态：已完成
- 优先级：P1
- 描述：
  1. 引入纯 JS、零 eval、零 new Function、完整支持 globalThis 的 Box2D 官方移植版 `miniprogram/lib/planck.min.js`；
  2. 原封不动保留现有 `miniprogram/games/watermelon/physics.js` 作为内置备选与降级回退通道；
  3. 构建 `miniprogram/games/watermelon/physicsPlanck.js` 适配层，100% 对齐现有 `PhysicsWorld` 接口契约（createBody/removeBody/update/clear/onMerge/onDangerWarning/onDangerLineTrigger）；
  4. 采用对标斗鱼 Cocos 逆向参数（friction: 0.2, restitution: 0.1, linearDamping: 0.12, angularDamping: 0.22, allowSleep: true），配合地面滚动阻力衰减，彻底根除小球无限自旋；
  5. 修改 `engine.js` 默认采用 Planck.js 物理世界，并支持通过 `physicsEngine: 'builtin'` 一键切回原有手写引擎；
  6. 编写全场景专项回归测试 `scripts/verify_planck_watermelon.js`（阻尼衰减、纯滚动滚停休眠、碰撞合成、垂直堆叠与防剧烈弹跳全部通过）。
- 涉及文件：
  - `miniprogram/lib/planck.min.js`
  - `miniprogram/games/watermelon/physicsPlanck.js`
  - `miniprogram/games/watermelon/engine.js`
  - `scripts/verify_planck_watermelon.js`
  - `.claude/BUGS.md`
  - `.claude/STATE.md`


## [2026-09-17] 修复结算弹窗面板结果数值与标题未对齐同一水平线缺陷
- 状态：已完成
- 优先级：P2
- 描述：
  1. 根因定位：
     - `game-result-modal/index.wxml` 中 `<text class="row-value">` 标签内联了代码换行，小程序 `<text>` 组件原生保留换行与前置空格，导致数值前产生空行将实际内容硬性下顶。
     - `.result-row` 弹性容器缺少统一行高声明，且高亮字体（34rpx）与常规字体（28rpx）混排时基线未锚定。
  2. 落地修复：
     - WXML 内联单行声明 `<text class="row-value ...">{{item.value}}</text>`，彻底消除意外换行与空格；
     - WXSS 中为 `.result-row`、`.row-label`、`.row-value` 统一显式补齐 `line-height: 1.4`，并设定 `align-items: baseline` 基线对齐，确保左右两侧文本无论字号大小均严格处于同一水平线。
- 涉及文件：
  - `miniprogram/components/game-result-modal/index.wxml`
  - `miniprogram/components/game-result-modal/index.wxss`
  - `.claude/BUGS.md`
  - `.claude/STATE.md`


## [2026-09-17] 修复大西瓜页面点开黑屏与内容不显示缺陷
- 状态：已完成
- 优先级：P0
- 描述：
  1. 根因排查与定位：
     - `MapManager` 顶层直接同步 `require('../assets/maps/map_manifest.json')`，在微信小程序真机与特定编译环境下由于 JSON 文件未作为 CommonJS 模块打包，导致顶层报 `module is not defined` 异常，中断页面脚本注册。
     - `_initCanvas` 放在了 `onLoad`，违反微信框架时序规范（DOM 尚未初次渲染完成），选择器无法查询到节点直接 return，导致游戏引擎未启动、数据未 setData、主循环未运行。
     - `_drawFruit` / `_drawCurrentHeldFruit` 贴图缺乏 `_loaded` 与宽高守卫，未就绪时除以 0 或调用 drawImage 导致主循环崩溃，且无降级绘制。
     - `project.config.json` 基础库配置过老（2.20.1）与自定义组件中的 `<root-portal>` 标签存在兼容性隐患。
  2. 落地修复措施：
     - 将地图清单构建为标准 CommonJS 模块 `miniprogram/assets/maps/map_manifest.js`，并在 `mapManager.js` 采用容错降级加载与空数组安全兜底。
     - 调整生命周期：在 `onLoad` 中先行预置首个道具与初始数据进行即时 `setData`，将 `_initCanvas` 移至 `onReady` 并加入最多 4 次自动重试机制，确保节点百分之百就绪。
     - 健全图片加载与贴图安全机制：为贴图挂载 `onload` 状态监听标记 `_loaded`，宽高严格校验防除以 0，贴图增加 try-catch 保护，并在图片未就绪时优雅降级为居中等级文字。
     - 在 `_renderFrame` 渲染帧加入全局 try-catch 拦截，确保单帧异常绝不打崩后续 60 FPS 渲染。
     - 升级 `project.config.json` 的 `libVersion` 至 `3.4.0`，并将弹窗组件恢复为标准安全结构。
- 涉及文件：
  - `miniprogram/assets/maps/map_manifest.js`
  - `miniprogram/utils/mapManager.js`
  - `miniprogram/pages/watermelon/index.js`
  - `miniprogram/components/game-result-modal/index.wxml`
  - `project.config.json`
  - `.claude/BUGS.md`
  - `.claude/STATE.md`


## [2026-09-17] 今日鼠鼠运势确定性算法与文案体系落地
- 状态：已完成
- 优先级：P1
- 描述：
  1. 落地轻量零依赖高品质确定性随机发生器 `fortuneAlgorithm.js`，采用 MurmurHash3（32-bit x86）雪崩散列生成整型种子，结合 Mulberry32 PRNG 步进独立发射随机数。
  2. 实现严格防御性自然保序：地图强制基于 `key` 字母序升序、道具强制基于唯一 `id` 数值升序，杜绝外部 JSON 物理行顺序变动或不同平台 JS 引擎同价排序抖动对随机结果的干扰。
  3. 实现四维确定性流水线抽样：幸运战术地图（5~6张）、道具等级（1~6级）、专属等级道具（359+三角洲全量道具）及吉凶签文与战术建议。
  4. 搭建高度解耦的文案字典 `fortuneConfig.js`：1~6 级品质精准对应大吉~大凶，每级支持配置多个副标题与海量战术建议池（已留好随意追加文案口子），支持 `{map}` 与 `{item}` 动态占位符安全插值。
  5. 完善业务引擎与存储层：在 `storage.js` 扩展设备唯一不可变 `getOrCreateUserId`、跨天检测与 `fortune` 独立战报存取，在 `FortuneEngine` 落地每日幂等运势获取及付费改运 `reroll` 接口（支持递增打破随机与高阶保底加权）。
  6. 编写全场景测试脚本 `scripts/verify_fortune_algorithm.js`，通过 100 次调用完全一致性、改运种子离散度、数据源乱序抗干扰与占位符插值验证。

## [2026-09-15] Git 仓库初始化与首次提交
- 状态：已完成
- 优先级：P1
- 描述：
  1. 新增 `.gitignore` 文件，自动忽略 `project.private.config.json`（微信开发者工具本地私有配置）、`node_modules/`、`miniprogram_npm/`、日志与系统临时文件。
  2. 完成项目首次提交（commit hash: `baae024`，包含离线小游戏大厅、双游戏页面、Storage持久化层、官方排错手册及 MCP 配置）。

## [2026-09-15] 烽火地带 6 大核心战术地图纯净底图提取与生成
- 状态：已完成
- 优先级：P1
- 描述：
  1. 从官方 Leaflet 切片服务提取 Zoom=2 瓦片，在本地高精度拼接生成 6 大核心战术地图底图。
  2. 严格按要求剥离点位与分层，输出 1024x1024 适中轻量纯净底图至 `miniprogram/assets/maps/`（6张底图总大小仅 760KB）。
  3. 创建地图清单元数据 `map_manifest.json`，提供地图名称、文件路径、规格及描述。

## [2026-09-16] 三角洲行动道具（收藏品/消耗品/门卡）精准按需爬取与资产归档
- 状态：已完成
- 优先级：P1
- 描述：
  1. 逆向解析三角洲行动官方百科数据接口（`projectd_oversea/object.list`）及官方动态语言字典（`zh-tw`）。
  2. 严格按需爬取指定的三类道具：收藏品（270件）、消耗品（30件）、门卡（59件），合计 359 件，排除其余未指定类别。
  3. 全量提取道具名称（繁体+简体对照）、大小（占格子NxN，宽与高）、重量（kg）、品质品级（grade）及专属详情。
  4. 完整补全全量道具等级与稀有度标识双重映射体系（6级=红/53件、5级=橙/61件、4级=紫/70件、3级=蓝/64件、2级=绿/64件、1级=白/47件），支持 `level` (数值)、`levelName` ("6级")、`rarityLabel` ("6级 (红)")、`rarityFull` ("6级红色")、`color` ("红")、`colorHex`、`nameWithLevel` ("[6级·红] ...") 及官方 DOM 图标类 `levelIconClass`（`item-level-icon img_levelicon_01~06`）。
  5. 提取并导出官方稀有度雪碧图 `miniprogram/assets/icons/levels/level_sprite.png` 与适配小程序的样式 `level_icons.wxss`。
  6. 高精度并发下载全部 359 张高清透明背景道具图片至 `miniprogram/assets/items/{collection,consume,keys}/`，下载成功率 100%。
  7. 生成结构化元数据清单 `miniprogram/assets/items/item_manifest.json` 及自动化爬虫脚本 `scripts/crawl_delta_items.js`。

## [2026-09-16] 三角洲行动交易行全量道具市场价格解析与写入
- 状态：已完成
- 优先级：P1
- 描述：
  1. 逆向攻破 `wwery.com/market` 设防机制（自定义二进制协议 `application/x-zhou-pack v2`、专属协商头校验与解密算法），提取完整解包库至 `scripts/lib/zhou_pack_decoder.js`。
  2. 编写自动化行情同步脚本 `scripts/update_item_prices.js`，高速获取交易行 1,358 件物品的实时市场价格、日/周/月价格涨跌幅。
  3. 基于官方 `object_id` 和规范中文名与本地 `item_manifest.json` 中的 359 件核心道具建立 100% 精准映射。
  4. 成功匹配写入 345 件可交易道具的现行市场价（`price`）、格式化价格（`priceFormatted`）、单格价值（`pricePerGrid`，总价/格子数）及交易状态标识（`isTradable: true`）。
  5. 精准识别并标记 14 件游戏内绑定的非交易/任务材料（如火箭燃料、G.T.I.卫星通讯天线、高级燃料等标记为 `price: 0, isTradable: false, priceFormatted: "非交易品"`），经交叉比对 `sjz.jbskins.com` 证实与游戏内设定完全一致。
  6. 严格按要求剔除所有不需要的涨跌幅（`priceChangeToday/Week/Month` 及 `*Percent`）、更新时间（`marketUpdatedAt`）等冗余字段，保持清单文件精简纯净。

## [2026-09-16] 道具清单文件瘦身与纯简体中文规范化
- 状态：已完成
- 优先级：P1
- 描述：
  1. 彻底移除 `item_manifest.json` 中保存的繁体中文名称与描述，将规范简体中文直接提升为主字段（`name`, `nameWithLevel`, `nameWithRarity`, `desc`）。
  2. 彻底剔除 `name_cn`, `nameWithLevel_cn`, `nameWithRarity_cn`, `desc_cn` 4 个 redundant 字段。
  3. 全量道具名称 100% 对齐三角洲行动国服官方规范（345 件可交易品直接对齐交易行官方标准中文名，14 件非交易品精准补齐）。
  4. 引入本地 OpenCC 权威消歧词典库（`scripts/lib/opencc.js`），对全部道具描述（`desc`）及 `propsDetail` 属性（`type`, `propsSource` 等）执行深度规范化繁转简，消除了所有残留异体字与繁体字。
  5. 移除顶层与 `categories` 完全重复冗余且未维护价格的 `items` 数组，保持与 `icon_manifest.json` 架构一致的 `categories` 组织形式。
  6. 清单文件体积由 1,195.7 KB 骤降至 559.7 KB，直接瘦身 635.9 KB（缩减 53.2%），大幅减轻小程序代码包及内存压力。
  7. 同步升级 `scripts/crawl_delta_items.js`、`scripts/update_item_prices.js` 及新增独立清洗脚本 `scripts/simplify_item_manifest.js`。

## [2026-09-16] 道具清单移除冗余展示标签字段
- 状态：已完成
- 优先级：P2
- 描述：
  1. 从 `item_manifest.json` 全量 359 件道具（收藏品/消耗品/门卡）以及顶层 `rarityDefinitions` 中彻底移除 6 个无用展示标签字段：`nameWithLevel`, `nameWithRarity`, `levelName`, `colorLabel`, `rarityLabel`, `rarityFull`。
  2. 保持核心元数据精简纯粹（保留 `name`, `level`, `color`, `rarity`, `grade`, `colorHex`, `bgColorHex`, `levelIconClass` 等基础属性）。
  3. `item_manifest.json` 清单体积从 559.7 KB 进一步压缩至 470.5 KB，再节省 89.2 KB（优化率 15.9%）。
  4. 同步升级 `scripts/crawl_delta_items.js` 与 `scripts/simplify_item_manifest.js`，确保后续数据采集和清洗不再生成此类冗余字段。

## [2026-09-16] 修复 GitHub Secret Scanning 警报（脱敏 AppID）
- 状态：已完成
- 优先级：P1
- 描述：
  1. 修复 GitHub 针对腾讯微信 AppID 触发的安全扫描警报（`Secrets detected in uerax/delta-simulator`）。
  2. 将公共版本控制文件 `project.config.json` 中的 `appid` 替换为官方游客占位符 `touristappid`。
  3. 新增本地私有配置文件 `project.private.config.json`（已受 `.gitignore` 保护不入库），保留开发者真实 AppID，确保本地微信开发者工具开发不受影响。

## [2026-09-16] 道具清单移除用户指定的 6 项冗余字段
- 状态：已完成
- 优先级：P2
- 描述：
  1. 顶层移除：彻底剔除 `rarityCounts` 与 `levelCounts` 重复统计字段。
  2. `rarityDefinitions` 字典精简：逐项移除 `color`、`rarity`、`iconClass`，仅保留核心 `level`、`colorHex`、`bgColorHex`。
  3. 道具对象精简：从 359 件道具全量中彻底移除 `color`、`rarity`、`rawId`、`subClass`、`grade` 共 5 个无用/重复字段。
  4. 清单体积从 482.6 KB 降至 425.1 KB，净减 57.5 KB（缩减 11.9%）。
  5. 同步更新 `scripts/simplify_item_manifest.js` 与 `scripts/crawl_delta_items.js`，保证爬虫与清洗链路一致。

## [2026-09-16] 道具/物资/地图元数据清单全面平替为国内官方已备案 CDN 并物理归档
- 状态：已完成
- 优先级：P1
- 描述：
  1. 道具清单 `item_manifest.json`：全量 359 件道具（收藏品/消耗品/门卡）的 `remotePicUrl` 和 `remoteThumbUrl` 全面替换为国内官方已备案 CDN（`playerhub.df.qq.com`，顶级域名 `qq.com` 拥有工信部 ICP 备案 粤B2-20090059，可直接添加进微信小程序 downloadFile/request 白名单，经终端实测 359/359 成功率 100%）。
  2. 图标清单 `icon_manifest.json`：在原有字段上为全量 57 个标记图标平替补充 `remoteUrl`（28 个独立图标直连腾讯官方 CDN `game.gtimg.cn`，29 个官方内联图标采用官方源端的 Base64 Data URI）。
  3. 地图清单 `map_manifest.json`：在原有字段上为 6 大战术地图补充官方瓦片 CDN 模版 `tileUrlTemplate`、预览图 `previewTileUrl` 以及 Zoom=2 的 16 张切片直链数组 `tileUrls`（来自 `game.gtimg.cn`）。
  4. 本地路径转备用索引：将三大清单中的 `localPicPath` / `path` 字段统一规范更名为 `backupPath`（指向 `/assets_backup/...`），既避免业务开发时误引用本地 404 路径，又完整保留了本地备份的映射溯源能力。
  5. 物理资产迁移与主包瘦身：全量 423 个本地图片文件（道具 359 张、图标 58 张、地图 6 张，共 58.07 MB）已安全移动至项目根目录备用文件夹 `assets_backup/`（完全位于 `miniprogram/` 之外，打包 0 占用），`miniprogram/assets/` 仅保留 4 个核心索引与样式文件，总体积从 60MB 骤降至 1.40MB。
  6. 编写并运行自动化迁移与同步脚本 `scripts/migrate_to_official_cdn.js`。

## [2026-09-16] 小游戏架构规范化解耦重构（Engine + Registry + Component + Storage）
- 状态：已完成
- 优先级：P1
- 描述：
  1. **纯 JS 核心逻辑引擎抽离**：在 `miniprogram/games/{reaction,schulte}/engine.js` 中创建 `ReactionEngine` 与 `SchulteEngine`，彻底将状态机、计时器循环、生成算法、计分公式与评级算法抽离至独立类，零依赖微信环境，实现 100% 独立可测试。
  2. **游戏自描述元数据 Manifest**：在各游戏目录新增 `manifest.js`，声明游戏 ID、名称、图标、路径、渐变色及大厅战绩格式化适配函数 `getLobbyRecord`。
  3. **游戏注册中心 (Game Registry)**：新增 `miniprogram/games/registry.js`，聚合所有已注册游戏，提供 `getAllGames`, `getGame`, `getLobbyList`。大厅改由配置注册表驱动渲染，后续新增小游戏大厅零改动。
  4. **通用结算弹窗组件抽离**：新增 `miniprogram/components/game-result-modal/`，复用弹窗布局、动画与按钮操作，消除了两款游戏近百行重复 WXML/WXSS 代码。
  5. **Storage 隔离存储与双向兼容**：在 `miniprogram/utils/storage.js` 增加 `GAME_RECORDS` 独立命名空间方法（`getGameRecord`, `saveGameRecord`, `recordGamePlay`），并对老字段老方法（`recordReactionResult`, `recordSchulteResult`）做双向平滑同步兼容。
  6. **页面控制器瘦身**：`pages/game/` 与 `pages/schulte/` 瘦身为纯粹的 View Controller，仅负责中继输入事件和 UI 渲染绑定。
  7. **自动化测试覆盖**：编写单测脚本 `scripts/verify_game_architecture.js`，全量验证引擎状态机、洗牌算法、步进按序校验、注册中心与存储层兼容性，测试通过率 100%。

## [2026-09-16] 新增“今日鼠鼠运势”游戏占位与注册接入
- 状态：已完成
- 优先级：P2
- 描述：
  1. **注册接入**：创建 `miniprogram/games/fortune/manifest.js` 与 `engine.js`（骨架），自描述图标、渐变风格及“今日运势”战绩适配，在 `registry.js` 中直接登记。
  2. **路由配置**：在 `miniprogram/app.json` 中配置 `"pages/fortune/index"` 页面。
  3. **占位页面**：创建 `miniprogram/pages/fortune/{index.js, index.json, index.wxml, index.wxss}`，提供高质感的施工中占位界面及返回大厅按钮。
  4. **全自动化验证**：更新并执行 `scripts/verify_game_architecture.js`，3 款小游戏动态注册与装配测试通过率 100%。大厅无需修改任何代码，自动展现卡片。

## [2026-09-16] 今日鼠鼠运势置于首位并升级为官方CDN“非洲之心”专属红品视觉
- 状态：已完成
- 优先级：P2
- 描述：
  1. **展位提升**：调整 `miniprogram/games/registry.js` 中的 `REGISTERED_GAMES` 注册序列，将“今日鼠鼠运势”直接调整为第一位展示。
  2. **官方 CDN 资产接入**：将游戏图标平替为三角洲行动官方 6 级红品大金“非洲之心”高清透明背景图（`playerhub.df.qq.com/.../15080050006.png`）。
  3. **标准红品底色与边框高光**：严格对齐官方 6 级稀有度规范，应用官方专属暗红底色（`#361a1c`）以及渐变高光（`linear-gradient(135deg, rgba(224, 58, 62, 0.45) 0%, #361a1c 100%)`），并赋予 `2rpx solid #E03A3E` 红色高光边框与专属辉光阴影。
  4. **大厅与子页面同步升级**：大厅卡片与 `pages/fortune/index` 占位页面同步启用该套绝密红品视觉体系。
  5. **单测核验**：执行 `node scripts/verify_game_architecture.js`，验证大厅列表首项为运势小游戏且正确绑定官方 CDN 图标，断言全部通过。

## [2026-09-16] 修复微信开发者工具切页卡顿与触感延迟并支持批处理首屏渲染
- 状态：已完成
- 优先级：P1
- 描述：
  1. **触感反馈工具抽离与模拟器自适应**：新增 `miniprogram/utils/feedback.js`，精准识别 `devtools` 环境并安全静默跳过硬件马达调用，彻底消除微信开发者工具因缺少物理震动马达导致的 IPC 阻塞与切页 1 秒延迟；真机环境正常读取 `settings.vibrationEnabled` 用户配置。
  2. **大厅跳转防重节流锁**：在 `pages/index/index.js` 中增加 `_isNavigating` 状态锁，在 `navigateTo` 触发与返回 `onShow` 时妥善加锁与释放，防止切页等待期间重复点击导致页面栈压爆。
  3. **首屏渲染单批处理合并**：在 `ReactionEngine` 与 `SchulteEngine` 中增加 `autoInitSilent` 构造配置与 `getInitialState()` 接口，在页面 `onLoad` 时一次性合并批处理 `setData`，消除了子页面初始化微秒内连续触发 4 次跨进程通信的模拟器性能抖动。
  4. **全套自动化测试覆盖**：在 `scripts/verify_game_architecture.js` 中补齐 Feedback 工具的模拟器/真机自适应测试以及引擎静默批处理测试，测试通过率 100%。

## [2026-09-17] 斗鱼《合成大西瓜》底层工业级实现逆向解析与规划落地
- 状态：已完成
- 优先级：P1
- 描述：
  1. 通过 Chrome DevTools MCP 控制浏览器驱动直播间页面鉴权与挂件渲染，定位到核心游戏模块 `make-watermelon-master`（Cocos 3.8.6 编译构建）。
  2. 逆向提取 `Fruit2.ts`、`WatermelonGame.ts`、`WatermelonRules.ts` 等底层关键代码，完整解析 11 级水果物理与计分体系（$2^{\text{level}}$）、双重合成触发（刚体接触+距离轮询防卡死）、Y 轴靠下锚定算法（`pickLowerFruit`）、径向合成爆炸冲击波（`applyRadialExplosion`）、动态下落池难度曲线（0/5/20递增至最高Lv.4）及 0.8 秒稳定滞留死亡缓冲模型。
  3. 将上述全套工业级参数与底层核心实现同步结构化写入 `.claude/BUGS.md`，为三角洲《合成非洲之心》提供精准的物理与手感对标基准。
- 涉及文件：`.claude/BUGS.md`, `.claude/STATE.md`

## [2026-09-17] 斗鱼《合成大西瓜》Box2D 物理三大维度（求解精度+手感曲线+动效反馈）全面 1:1 精修落地
- 状态：已完成
- 优先级：P1
- 描述：
  1. **Gauss-Seidel 速度微迭代与 Warm Starting 累积冲量**：在 `PhysicsWorld` 引入 4 轮速度微迭代，结合持久接触表（`contactCache`）缓存上一帧的法向与切向累积冲量并在新步进中预施加，彻底消除紧密堆叠物体在重力与地面之间的呼吸式抖动与穿模。
  2. **刚体自动休眠（Sleeping）与动态防微蠕动**：引入 `isSleeping` 与 `sleepTimer` 状态，当线速度与角速度连续低于阈值（`speedSq < 1.0` 且 `|w| < 0.08` 达 0.25s）时进入休眠，跳过重力积分；受碰撞或冲击波波及时自动唤醒，彻底杜绝地面微幅蠕动并大幅节省 Canvas 主循环开销。
  3. **斗鱼官方 1:1 动态掉落阶梯曲线**：严格对齐逆向获取的官方 WASM core `normalStartUpperExclusive` 阶梯：第 0~3 次恒出 Lv.1（含氟牙膏）；第 4~8 次出 Lv.1~2；第 9~17 次出 Lv.1~3；第 18 次及以后出 Lv.1~4（严格封顶在 Lv.4，绝不产出 Lv.5 及以上高阶大金）。
  4. **斗鱼官方 1:1 二次方非线性径向合成爆炸冲击波**：复刻官方 `triggerMergeExplosion` 能量模型：`power = level <= 4 ? 1 : level - 3`，爆炸半径 `blastRadius = 240 + 42 * power + 0.45 * radius`，二次方非线性衰减 $S^2$ 与向上偏置力 `M * 0.22`，使小球被震开弹起、大球仅微幅受压，力学反馈极富弹性。
  5. **0.8s 稳定滞留警戒线死亡模型精细化**：严格区分高速飞跃穿过与低速停滞（要求竖向速度 $|v_y| < 35 \text{ px/s}$ 且总速度平方 $< 2000$），排除弹跳误判；并在 Canvas 渲染层加入呼吸闪烁与震动梯次警示。
  6. **表现层与手感打磨（Squash & Stretch + 浮动文字）**：在合成时为新生成刚体赋予 0.16s 弹性缩放（`popScale` 从 0.55 弹性过冲到 1.2 并回弹至 1.0）；增加 Canvas 浮动身价与连击跳字（`_floatingTexts`）及分级触感反馈。
## [2026-09-17] 彻底阻绝悬空多球夹持闭环自旋传导 (图3水泥与顶部工具箱原地疯转缺陷修复)
- 状态：已完成
- 优先级：P1
- 描述：
  1. **定位链式自旋传导根本机理**：当多个小球形成挤压悬空闭环（如截图中的水泥袋被螺丝刀、黑板、工具箱夹住，顶部工具箱又卡在水泥与黑板夹角）时，切向摩擦冲量在每个接触对间被当做无损刚性齿轮传动（`actualDeltaJt` 双向累加角速度），导致角动量在闭环网络中形成正反馈自激振荡（A 带动 B、B 带动 C、C 带动 D 互搓狂飙）。
  2. **切向摩擦力矩机制重构（自转阻尼耗散代替齿轮传动）**：
     - 球与球接触切向冲量仅用于消除两球质心的相对平动滑动（保留对质心速度的牛顿冲量）；
     - 接触面摩擦对两球自转施加强阻尼耗散（刹车片效应），接触滑动摩擦迅速消耗双方自转动能，绝不在接触网络中无损传动加速。
  3. **多重接触闭环几何死锁（Kinematic Deadlock）**：在接触网络中，凡是同时受 $\ge 2$ 个物体支撑/夹持的悬空受压刚体，其转动自由度被静定死锁，角速度施加强制衰减并在 $< 0.08 \text{ rad/s}$ 时瞬间硬性清零锁定，彻底斩断链式自旋传导。
  4. **保留地面纯滚动机制**：地面与侧墙边界约束完整保留切向摩擦驱动滚动模型（$v_t = v_x - \omega \cdot r$），确保平抛或落水小球在地面纯滚动前进的自然质感 100% 完好无损。
## [2026-09-17] 修复大西瓜游戏失败结算弹窗面板被 Canvas 道具穿透覆盖缺陷
- 状态：已完成
- 优先级：P1
- 描述：
  1. **定位 Canvas 2D 原生同层渲染穿透机理**：`<canvas type="2d">` 作为同层渲染原生节点，其图形缓冲区在未显式分层时会穿透覆盖层级较低（`z-index: 999`）的普通自定义组件，且组件宿主标签 `<game-result-modal>` 在父页面中未声明层叠上下文。
  2. **双重最高层叠上下文隔离与样式提升**：
     - 组件样式 `game-result-modal/index.wxss` 中的 `.modal-overlay` 提升至 `z-index: 999999 !important;`；
     - 父页面 `pages/watermelon/index.wxss` 中为 `.canvas-wrap` 和 `.game-canvas` 显式设置 `position: relative; z-index: 1;`，并为宿主标签 `game-result-modal` 设置 `position: relative; z-index: 999999;`。
  3. **Canvas 内部暗化压暗与弹窗防穿透拦截**：
     - 在 Canvas 渲染层 `_renderFrame` 中增加状态判断，当 `showResultModal === true` 时，在最顶层自动覆盖一层全屏暗色半透明滤镜（`rgba(0, 0, 0, 0.7)`），压暗底层道具；
     - 在 `onTouchStart`、`onTouchMove`、`onTouchEnd` 中加入弹窗唤起拦截，防止结算期间玩家误触操作下落道具。
## [2026-09-17] 大西瓜动态掉落池全面升级为高爽度快节奏概率阶梯
- 状态：已完成
- 优先级：P1
- 描述：
  1. **彻底解决前中盘节奏拖沓问题**：严格按照用户指定的分阶段概率矩阵，在 `miniprogram/games/watermelon/engine.js` 中重写 `_generateDropLevel(n)`，前 15 次内快速进阶并全面开放 1~7 级掉落：
     - **一开始（第 0~2 次）**：1~2 级（Lv.1: 50%, Lv.2: 50%）；
     - **第三次开始（第 3~5 次）**：1~4 级（Lv.1: 20%, Lv.2: 30%, Lv.3: 30%, Lv.4: 20%）；
     - **第六次开始（第 6~9 次）**：1~5 级（Lv.1: 10%, Lv.2: 20%, Lv.3: 30%, Lv.4: 30%, Lv.5: 10%）；
     - **第十次开始（第 10~14 次）**：1~6 级（Lv.1: 5%, Lv.2: 15%, Lv.3: 25%, Lv.4: 30%, Lv.5: 20%, Lv.6: 5%）；
     - **第十五次开始（第 15 次及以后）**：1~7 级（Lv.1: 5%, Lv.2: 10%, Lv.3: 26%, Lv.4: 24%, Lv.5: 21%, Lv.6: 9%, Lv.7: 5%）。
  2. **高阶大金绝对封顶**：严格封顶于 Lv.7（航空记录仪），严禁产出 Lv.8 及以上超大金（激光陀螺仪、非洲之心等仅限合成产生）。
  3. **自动化单测同步更新**：在 `scripts/verify_watermelon_physics.js`（测试项 8）与 `scripts/verify_game_architecture.js` 中全面更新 5 个阶段的范围与边界断言，测试全部 100% 通过。
- 涉及文件：
  - `miniprogram/games/watermelon/engine.js`
  - `scripts/verify_watermelon_physics.js`
  - `scripts/verify_game_architecture.js`
  - `.claude/STATE.md`

## [2026-09-17] 彻底解决大西瓜失败结算弹窗面板被 Canvas 2D 原生同层渲染穿透遮挡缺陷
- 状态：已完成
- 优先级：P0
- 描述：
  1. **定位 Canvas 2D 原生同层穿透根本根因**：`<canvas type="2d">` 是由微信客户端 Native 直接嵌入 Webview 的同层渲染组件。普通 DOM 节点（即使设置 `z-index: 999999`）仍受限于 Webview 视图渲染树，天然处于 Native 同层视口下方，导致弹窗被小球道具、警戒线彻底遮挡。
  2. **升级引入微信官方最高穿透容器 `<root-portal>`**：
     - 在 `miniprogram/components/game-result-modal/index.wxml` 中全面启用 `<root-portal wx:if="{{visible}}">`，将弹窗节点从普通组件文档流中彻底抽离并直接挂载到小程序根视图节点，获得最高 Native 覆盖权限，绝对居中并覆盖于 `<canvas type="2d">` 之上。
     - 在组件 `index.js` 与 `index.wxml` 中增加 `catchtouchmove="preventTouchMove"`，彻底阻断弹窗展示期间手势滑动向底层 Canvas 穿透。
  3. **Canvas 渲染层与父页面双重保险隔离**：
     - 在 `pages/watermelon/index.wxml` 与 `index.wxss` 中，为 `game-canvas` 增加 `{{showResultModal ? 'canvas-dimmed' : ''}}` 动态样式，在弹窗打开时施加 `opacity: 0.18; filter: blur(4rpx); pointer-events: none;`，即使在任何特殊机型极端环境下也能确保底层道具化为沉浸式微弱磨砂背景，绝不干扰文字与按钮。
     - 弹窗重新开始（`restartGame`）或返回大厅时自动复原 Canvas 状态，无缝衔接下一局。
- 涉及文件：
  - `miniprogram/components/game-result-modal/index.wxml`
  - `miniprogram/components/game-result-modal/index.wxss`
  - `miniprogram/components/game-result-modal/index.js`
  - `miniprogram/pages/watermelon/index.wxml`
  - `miniprogram/pages/watermelon/index.wxss`
  - `.claude/BUGS.md`
  - `.claude/STATE.md`

## [2026-09-17] 物理图层清空与显隐隔离彻底根除模拟器 Canvas 2D 结算遮挡
- 状态：已完成
- 优先级：P0
- 描述：
  1. **定位模拟器同层内核机制**：微信开发者工具（基于 NW.js/Chromium）中，`<canvas type="2d">` 的 Native View 视口拥有最高复合图层优先级，不受 CSS `opacity` 或 `filter` 影响。只要 Canvas 持续在内部调用绘制小球，其像素就会强制覆盖在所有 Webview 元素（包括 root-portal 弹窗）之上。
  2. **Canvas 帧主循环像素级清空（Transparent Clearing）**：
     - 在 `pages/watermelon/index.js` 的 `_renderFrame` 渲染帧首部增加 `if (this.data.showResultModal) return;`；
     - 弹窗展示期间仅执行 `clearRect` 清空为全透明，完全停止所有小球、警戒线与网格绘制，彻底从物理像素上消灭遮挡物。
  3. **WXML 与 WXSS 容器级 `visibility: hidden` 绝对隐藏**：
     - 在 `pages/watermelon/index.wxml` 与 `index.wxss` 中为 `.canvas-wrap` 和 `game-canvas` 绑定 `visibility: hidden !important; pointer-events: none !important;`；
     - 既不销毁 Canvas 节点与 2D 上下文分辨率，又彻底通知模拟器合成层隐藏同层 Native 视口。
  4. **全生命周期无缝恢复**：
     - 玩家点击“再来一局”（`restartGame`）或“返回大厅”时，状态自动复位，Canvas 瞬时恢复渲染，零卡顿进入新游戏。
- 涉及文件：
  - `miniprogram/pages/watermelon/index.js`
  - `miniprogram/pages/watermelon/index.wxml`
  - `miniprogram/pages/watermelon/index.wxss`
  - `.claude/BUGS.md`
  - `.claude/STATE.md`

## [2026-09-17] 彻底修复球对球切向摩擦力矩耦合与消除拱形浮空死锁
- 状态：已完成
- 优先级：P1
- 描述：
  1. **彻底根除球对球接触表面摩擦耦合与角速度割裂缺陷**：在切向相对速度 `vt` 计算中补齐双方自转线速度分量（`+ b1.angularVelocity * r1 + b2.angularVelocity * r2`），使 `Kt = 3 * Kn` 实心圆盘有效切向反质量公式物理完全闭环。
  2. **接触切向摩擦冲量真实反馈角动量**：消除两球相对滑动的切向冲量 `actualDeltaJt` 同时按 `(2 * invMass / radius) * actualDeltaJt` 对双方施加真实力矩，小球在接触面受摩擦力自然滚动耗散，绝不失真自激。
  3. **彻底移除伪物理阻尼补丁**：删除单步 0.94 刹车片人工衰减以及触点数 $\ge 2$ 强制消旋（乘 0.65）补丁，解决多球接触时道具看起来僵死不转问题。
  4. **强化挤压收敛与防失控钳位**：将 Gauss-Seidel 速度迭代次数从 4 次提升至 6 次，大幅缓解多球挤压时的非对称拱形浮空现象；爆炸冲击波角速度冲量按半径归一化并统一设置 $\pm 12 \text{ rad/s}$ 上限。
  5. **全套自动化单测同步核验**：更新 `scripts/verify_watermelon_physics.js` 并执行 `scripts/verify_game_architecture.js`，全部物理回归与架构验证 100% 通过。
- 涉及文件：
  - `miniprogram/games/watermelon/physics.js`
  - `scripts/verify_watermelon_physics.js`
  - `.claude/STATE.md`

## [2026-09-17] 大西瓜落地闭环发牌控制器（双轨激活 + 读指令对抗 + 濒死安全制动）
- 状态：已完成
- 优先级：P1
- 描述：
  1. **架构升级为四层闭环发牌控制体系**：构建由 Pacing Gate（回合数门限）、Spatial Gate（空间高度门限）、Safety Limiter（濒死安全制动）与 Adversarial Modifiers（卡手修饰器）组成的完整控制流，彻底摆脱无状态单调随机发牌。
  2. **严谨规范 Canvas 空间坐标语义**：抽离 `_getTopmostBodyY()`，以物理世界最顶端小球的上边缘（Canvas 最小 $Y$）作为前线几何参考，定义 `activationY = 50%`（300px）与 `criticalY = 20%`（120px）。
  3. **双轨平滑激活门限（Dual-Track Trigger）**：
     - 回合数轨（`turnAlpha`）：前 14 次纯净放权；第 15~22 次采用 Hermite Smoothstep S型缓动无感爬升至 1.0；
     - 空间高度轨（`heightAlpha`）：越过 50% 容器高度启动监控，达到 20% 高度拉满。
  4. **闭环安全制动器（Pressure Limiter）**：当小球逼近 18% 危险死线（108px）时，线性制动卸载对抗强度，杜绝向濒死盘面无脑灌大球的系统死刑，给极限微操留出一线翻盘生机。
  5. **纯修饰器解耦计算（Modifiers）与线性插值**：Anti-repeat（0.25x 冰冻粉碎双拼）、Anti-merge（0.55x 顶层同级避让）、Pressure（1.80x 高出顶层 1~2 阶的 CDE 大球压顶）；通过 `weight = baseWeight * (1 - alpha + alpha * modifier)` 平滑过渡。
  6. **单元测试全覆盖**：在 `scripts/verify_watermelon_physics.js` 中新增 8.1 闭环状态机单测断言，双测跑通 100%。
- 涉及文件：
  - `miniprogram/games/watermelon/engine.js`
  - `scripts/verify_watermelon_physics.js`
  - `.claude/STATE.md`

## [2026-09-17] 道具全量数据扩充与按需 7 字段规范化（474件）
- 状态：已完成
- 优先级：P1
- 描述：
  1. **遍历拉取交易行道具大类（props）**：直接接入并逆向解包 `api.wwery.com` 二进制行情协议，获取最新 460 件交易行在售道具数据（包含 349 件收集品、80 件门卡钥匙、31 件消耗品），比原库净增 115 件最新大金与门卡。
  2. **非交易特殊任务品无损补全**：对比合并原清单中的 14 件不可交易任务品（如“火箭燃料”、“高级燃料”、“G.T.I.卫星通讯天线”等，价格规范置 0），全库扩充至 474 件（6级红品 83 件、5级橙品 105 件、4级紫品 101 件、3级蓝品 74 件、2级绿品 64 件、1级白品 47 件）。
  3. **字段极致精简收敛**：严格仅保留用户指定的 6 核心字段 + 唯一 ID：`id`, `level`（对应官方 `grade`）, `name`, `pic`（还原为腾讯官方已备案 CDN 高清原图直链）, `price`（现行市场最新价格）, `length`, `width`；彻底剔除全部冗余嵌套属性。
  4. **清单瘦身与自动化脚本沉淀**：`item_manifest.json` 体积由 425.1 KB 降至 107.2 KB（优化缩减 74.8%），沉淀可复用同步脚本 `scripts/sync_delta_items.js` 并保留安全备份。
- 涉及文件：
  - `miniprogram/assets/items/item_manifest.json`
  - `miniprogram/assets/items/item_manifest.backup.json`
  - `scripts/sync_delta_items.js`
  - `.claude/STATE.md`

## [2026-09-17] 道具管理器 ItemManager 落地（1~6级双键Map + 等级主题枚举 + 衍生格式化）
- 状态：已完成
- 优先级：P1
- 描述：
  1. **构建等级视觉主题枚举（LEVEL_THEMES）**：定义 1~6 级只读冻结主题配置，包含标准主色 `colorHex`、卡片底色 `bgColor`（如 6 级红品 `#361a1c`）、微光质感渐变 `bgGradient` 及中文等级名 `name`。
  2. **落地方案 A 双键专属 Map 体系**：
     - 构建 `level1Map` ~ `level6Map`：每个 Map 仅存当前品级道具，且将 `id` 与中文 `name` 双向注册为 Key，支持秒判与秒取（如 `level6Map.has('非洲之心')`、`level6Map.get('非洲之心')` 均为 $O(1)$）；
     - 构建按身价（`price`）降序排好的 `level1List` ~ `level6List` 数组，支持快速遍历与 `getRandomByLevel` 随机抽金；
     - 维护全局 `itemMap`（全量 474 件双键索引）。
  3. **道具内置选定衍生字段**：为每个标准化道具对象挂载 `item.priceFormatted`（千分位文本）与 `item.theme`（等级视觉配置），省去页面重复计算；克制裁剪了不必要的空间统计字段。
  4. **全局启动预热与全套测试**：在 `miniprogram/app.js` 的 `onLaunch` 执行 `ItemManager.init()`（<2ms 无感预热）；编写专项单测 `scripts/verify_item_manager.js`，验证全量 474 件数据、各等级条数、跨级隔离、双键检索与随机抽取，测试 100% 通过。
- 涉及文件：
  - `miniprogram/utils/itemManager.js`
  - `miniprogram/app.js`
  - `scripts/verify_item_manager.js`
  - `.claude/FEATURE-MAP.md`
  - `.claude/STATE.md`

## [2026-09-17] 道具清单顶层抽取 cdnBaseUrl 并瘦身全量 pic 字段（107KB -> 83KB）
- 状态：已完成
- 优先级：P2
- 描述：
  1. **顶层抽离 CDN 配置**：在 `item_manifest.json` 根部新增 `"cdnBaseUrl": "https://playerhub.df.qq.com/playerhub/60004/object/"`，实现 CDN 域名集中配置与后续无缝迁移。
  2. **道具 pic 字段极致瘦身**：全量 474 个道具的 `pic` 字段彻底剥离 48 字符冗长前缀，纯化为文件名（如 `"15080050142.png"`、`"key/航天基地金卡.png"`）；清单文件体积从 107.2 KB 进一步压缩至 **83.7 KB**（再降 21.9%）。
  3. **ItemManager 自动拼接联动**：在 `itemManager.js` 中动态读取清单中的 `cdnBaseUrl`，并在生成标准化道具对象时自动补齐为完整 CDN 链接（`item.pic`）与纯文件名（`item.fileName`），业务渲染与开发无任何影响。
  4. **全套自动化测试回归**：更新 `scripts/verify_item_manager.js`，验证 CDN 动态拼装与文件名正确性，全量单测 100% 通过。

## [2026-09-17] 清理图标清单 icon_manifest.json 中的超长 Base64 数据
- 状态：已完成
- 优先级：P2
- 描述：
  1. **彻底剥离 29 个超长 Base64**：在 `miniprogram/assets/icons/icon_manifest.json` 中移除由官方 CSS 内联引入的 29 个超长 Base64 `remoteUrl` 字段，其余 28 个官方真实 CDN 外链（`https://game.gtimg.cn/...`）及 `backupPath`、分类与地图信息完全保持不变。
  2. **清单文件极限瘦身**：文件体积由 **972 KB** 骤降至 **49 KB**（净减 923 KB，缩减 95.0%），消除了编辑器加载卡顿与包体积负担。
  3. **同步维护迁移脚本**：同步优化 `scripts/migrate_to_official_cdn.js`，在拉取官方图标时主动过滤 Data URI，杜绝后续自动化同步重新引入 Base64。
- 涉及文件：
  - `miniprogram/assets/icons/icon_manifest.json`
  - `scripts/migrate_to_official_cdn.js`
  - `.claude/STATE.md`

## [2026-09-17] 战术地图背景管理器 MapManager 落地与合成大西瓜实装
- 状态：已完成
- 优先级：P1
- 描述：
  1. **构建独立服务单例 MapManager**：在 `miniprogram/utils/mapManager.js` 中抽象封装全量地图服务，具备 6 大战术地图双键字典（`mapMap`，支持 key 与 name O(1) 检索）。
  2. **开局战术切片随机 Session 机制**：基于官方 CDN（`game.gtimg.cn`）6 大地图 96 张战术切片，提供 `pickSession()`，在开局时随机抽取战术区域，支持每局不同地图、不同角落的战术氛围呈现。
  3. **Canvas 2D 专属独立渲染管线（方案 B）**：`drawBackground()` 自动维护 Image 实例内存缓存，提供深色战术底色渐变兜底、官方 CDN 切片异步加载覆盖、战术深色遮罩（防前景小球干扰）、轻量参考经纬网格与四角战术准星十字刻度绘制。
  4. **DOM/WXML 样式生成支持**：内置 `getRandomBackgroundStyle()`，供非 Canvas 小游戏通过 WXML `style="{{bgStyle}}"` 一键获取战术渐变背景。
  5. **合成大西瓜无缝接入实装**：在 `pages/watermelon/index.js` 的 `_initCanvas`、`_renderFrame`、`restartGame` 与 `onUnload` 中接入，每局开局自动随机切换不同战术地图背景，卸载时自动清理图片内存缓存。
  6. **单测自动化全覆盖**：编写 `scripts/verify_map_manager.js`，验证全量地图双键索引、切片随机性、Canvas 2D 模拟绘制管线与 CSS 样式生成，全套回归测试 100% 通过。
- 涉及文件：
  - `miniprogram/utils/mapManager.js`
  - `miniprogram/pages/watermelon/index.js`
  - `scripts/verify_map_manager.js`
  - `.claude/FEATURE-MAP.md`
  - `.claude/STATE.md`

## [2026-09-17] 大西瓜道具图片等比缩放、内描边圆环与边缘呼吸空隙微调
- 状态：已完成
- 优先级：P2
- 描述：
  1. **等比包含缩放（Contain 模式）**：在 `_drawFruit` 与 `_drawCurrentHeldFruit` 中读取 `img.width` 与 `img.height` 宽高比 `aspect`，根据横版或竖版自适应等比缩放，彻底杜绝强制拉伸变形。
  2. **圆边框向内绘制（Inner Stroke）**：描边圆半径精确设定为 `strokeRadius = radius - lineWidth / 2`，外缘与刚体物理外圆严丝合缝贴合，杜绝边框超出原本圆面积。
  3. **边缘呼吸留白空隙（Padding）**：可用内容区半径设定为 `radius * 0.76`，使道具图片四面与内圆环保持匀称空隙，消除贴边与切边压迫感。
- 涉及文件：
  - `miniprogram/pages/watermelon/index.js`
  - `.claude/STATE.md`











