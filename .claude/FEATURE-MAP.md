# 功能实现与路径索引 (FEATURE-MAP.md)

## 核心配置与入口
- 全局配置与路由：`miniprogram/app.json`
- 全局应用入口：`miniprogram/app.js`
- 全局样式：`miniprogram/app.wxss`
- 开发者工具配置：`project.config.json`、`project.private.config.json`

## 游戏领域层与注册中心 (Games Domain)
- **游戏注册中心 (Game Registry)**：`miniprogram/games/registry.js`
  - 核心能力：聚合所有小游戏 manifest，提供 `getAllGames`, `getGame`, `getLobbyList`。
- **游戏 1：今日鼠鼠运势 (Fortune)**：`miniprogram/games/fortune/`
  - 核心伪随机与抽样算法：`fortuneAlgorithm.js`（MurmurHash3 雪崩散列 + Mulberry32 PRNG 步进抽样，地图/道具/容器/地标全自然升序保序）
  - 独立文案与词库字典：`fortuneCopywriting.js`（1~6 级黑话与吉凶映射、老黄历宜忌、战术建议池、地标词库、战术容器字典，纯文案维护）
  - 规则参数与权重配置：`fortuneConfig.js`（正态钟形免费加权池、付费改运保底加权池，引入 copywriting 解耦）
  - 纯 JS 逻辑与持久化驱动引擎：`engine.js`（`FortuneEngine`，自动管理跨天重置、幂等运势读取、付费改运/逆天改命 Reroll 接口）
  - 游戏元数据与配置：`manifest.js`（自描述配置与今日运势状态展示适配）
- **游戏 2：合成非洲之心 (Watermelon / 非洲之心)**：`miniprogram/games/watermelon/`
  - 11 级阶梯道具元数据：`items.js`（官方已备案 CDN 道具、尺寸、物理质量与交易行身价）
  - 工业级 Planck.js (Box2D) 物理引擎适配层：`physicsPlanck.js`（`PhysicsWorldPlanck`，1:1 对标斗鱼 Cocos 物理参数与 120Hz 子步长累加器，摩擦力0.2，角阻尼0.22，低弹性0.1，偏心防发呆与休眠机制，彻底根除小球无限自旋）
  - 纯 JS 核心逻辑引擎：`engine.js`（`WatermelonEngine`，直接绑定 Planck.js 物理世界，动态下落池难度曲线、搜刮身价、连击算法与状态机）
  - 游戏元数据与配置：`manifest.js`（自描述配置与大厅战绩展示适配，6级红品专属底色与高光）
  - 第三方物理核心库：`miniprogram/lib/planck.min.js`（Erin Catto 官方 Box2D 纯 JS 移植版，零 eval，零 new Function，适配微信环境）
- **游戏 3：极速反应挑战 (Reaction)**：`miniprogram/games/reaction/`（大厅展示隐藏）
  - 纯 JS 核心逻辑引擎：`engine.js`（`ReactionEngine`，管理状态机、目标生成、计分连击与回调事件）
  - 游戏元数据与配置：`manifest.js`（自描述配置与大厅战绩展示适配，已配置 hidden: true）
- **游戏 4：舒尔特专注方格 (Schulte)**：`miniprogram/games/schulte/`（大厅展示隐藏）
  - 纯 JS 核心逻辑引擎：`engine.js`（`SchulteEngine`，管理乱序洗牌、步进按序校验、0.1s 计时与评级算法）
  - 游戏元数据与配置：`manifest.js`（自描述配置与大厅战绩展示适配，已配置 hidden: true）

## 通用组件 (Components)
- **通用游戏结算弹窗**：`miniprogram/components/game-result-modal/`
  - 视图与逻辑：`index.wxml`, `index.wxss`, `index.js`, `index.json`
  - 核心能力：支持新纪录勋章、自定义结算成绩明细数组、再玩一局与返回大厅统一操作。

## 业务模块与页面 (View Controllers)
- **大厅 / 入口汇集**：`miniprogram/pages/index/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 核心能力：由 `GameRegistry` 驱动渲染游戏卡片、玩家头像与昵称管理、今日战报与金币看板、全局音效/震动开关、数据重置。
- **页面 1：今日鼠鼠运势**：`miniprogram/pages/fortune/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`、`index.json`
  - 职责定位：占位页面（施工与方案对齐中），图标接入官方CDN“海洋之泪”。
- **页面 2：合成非洲之心**：`miniprogram/pages/watermelon/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`、`index.json`
  - 职责定位：高性能 Canvas 2D 控制器，零 setData 渲染主循环，Retina DPR 缩放适配，正圆图片贴图真实旋转滚落，接入通用弹窗组件与触感反馈。
- **页面 3：极速反应挑战**：`miniprogram/pages/game/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 职责定位：薄视图控制器（View Controller），事件转接至 `ReactionEngine`，接入通用弹窗组件。
- **页面 4：舒尔特专注方格**：`miniprogram/pages/schulte/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 职责定位：薄视图控制器（View Controller），事件转接至 `SchulteEngine`，接入通用弹窗组件。

## 工具库与数据层
- **用户管理与微信登录服务 (UserManager)**：`miniprogram/utils/userManager.js`
  - 核心能力：独立用户模块单例，封装 `wx.login` 临时凭证与微信登录状态机（未登录、登录中、已登录、登录失败），提供 `checkSession` 会话检测、`updateProfile` 资料同步（头像/昵称）、`logout` 登出与全局观察者（`on`/`off`/`_notify`）事件总线。
- **触感与交互反馈 (Feedback)**：`miniprogram/utils/feedback.js`
  - 核心能力：自动识别开发者工具环境（`devtools` 跳过马达调用消除卡顿）、真机硬件震动适配、读取 `settings.vibrationEnabled` 用户配置。
- **本地存储管理 (Storage)**：`miniprogram/utils/storage.js`
  - 玩家配置：`getUserProfile`, `setUserProfile`
  - 游戏命名空间隔离存储：`getGameRecord(gameId)`, `saveGameRecord(gameId, data)`, `recordGamePlay(gameId, options)`
  - 兼容战绩持久化：`recordReactionResult`, `recordSchulteResult`, `getTodayRecord`, `getGameStats`
  - 系统偏好：`getSettings`, `saveSettings`
  - 付费特权管理：`getPrivileges`, `savePrivileges`, `isPrivilegeUnlocked`, `unlockPrivilege`
  - 存储清空：`clearAll`
- **道具全局管理器 (ItemManager)**：`miniprogram/utils/itemManager.js`
  - 核心能力：`LEVEL_THEMES` 1~6 级主题与颜色枚举（底色/高光/渐变）、全局 `itemMap` 双键索引（按 ID 与名称 O(1) 检索）、1~6 级专属双键 Map（`level1Map` ~ `level6Map`）与身价降序列表、道具对象内置 `priceFormatted` 千分位金额与 `theme` 主题、按等级随机抽取 `getRandomByLevel`。
- **战术地图背景管理器 (MapManager)**：`miniprogram/utils/mapManager.js`
  - 核心能力：6 大战术地图双键索引（按 Key 与名称 O(1) 检索）、开局独立战术背景会话（`pickSession` 随机抽取 96 张官方切片之一）、Canvas 2D 独立渲染适配（`drawBackground`，自带图象内存缓存、深色遮罩与军事经纬十字刻度）、DOM 样式生成器（`getRandomBackgroundStyle`，供非 Canvas 页面一键绑定）。
- **战区物资点管理器 (SupplyManager)**：`miniprogram/utils/supplyManager.js`
  - 核心能力：对标 ItemManager，从 `supply_manifest.js` 动态加载，在 `init()` 中动态写入 `supplyMap`，提供全量物资列表（`getAll`）与按名称 O(1) 检索（`getByName`），单例导出 `new SupplyManagerService()`。
- **三角洲战术物资资源库**：
  - 地图运行时清单：`miniprogram/assets/maps/map_manifest.js`（CommonJS 标准导出）
  - 道具运行时清单：`miniprogram/assets/items/item_manifest.js`（CommonJS 标准导出）
  - 物资点运行时清单：`miniprogram/assets/supplies/supply_manifest.js`（CommonJS 标准导出，参考道具源极简格式，47 件去重物资、无战区划分、零冗余字段）
  - 稀有度等级图标与样式：`miniprogram/assets/icons/levels/` (红/橙/紫/蓝/绿/白 6 级图标雪碧图与 `level_icons.wxss`)
  - 离线维护数据源：`scripts/data/`
    - 地图源数据：`scripts/data/maps/map_manifest.json`
    - 图标源数据：`scripts/data/icons/icon_manifest.json`
    - 道具源数据：`scripts/data/items/item_manifest.json`
    - 物资点源数据：`scripts/data/supplies/supply_manifest.json`
  - 数据爬取、价格同步与导出脚本：`scripts/verify_supply_manager.js`、`scripts/generate_supply_manifest.js`、`scripts/verify_watermelon_merge_behavior.js`、`scripts/verify_game_architecture.js`、`scripts/verify_planck_watermelon.js`、`scripts/migrate_to_official_cdn.js`、`scripts/simplify_item_manifest.js`、`scripts/update_item_prices.js`、`scripts/lib/opencc.js`、`scripts/lib/zhou_pack_decoder.js`、`scripts/crawl_delta_items.js`、`scripts/generate_maps.ps1`、`scripts/download_icons.js`、`scripts/scan_df_data.js`

## 文档与 AI 技能
- 官方框架精简指南与排错手册：`docs/miniprogram-framework.md`
- MCP 配置文件：`.mcp.json`
- CloudBase 技能库：`.claude/skills/cloudbase/`
