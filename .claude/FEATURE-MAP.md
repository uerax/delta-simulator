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
  - 纯 JS 逻辑引擎骨架：`engine.js`（`FortuneEngine`，待方案对齐后补充完整规则）
  - 游戏元数据与配置：`manifest.js`（自描述配置与今日运势状态展示适配）
- **游戏 2：合成大西瓜 (Watermelon / 非洲之心)**：`miniprogram/games/watermelon/`
  - 11 级阶梯道具元数据：`items.js`（官方已备案 CDN 道具、尺寸、物理质量与交易行身价）
  - 工业级 2D 圆形刚体物理引擎：`physics.js`（`PhysicsWorld`，8 步 CCD 防穿透、低弹性0.1、滚动摩擦0.2、双阻尼、双重合成触发、`pickLowerFruit` 靠下锚定、径向冲击波与 0.8s 滞留警戒线）
  - 纯 JS 核心逻辑引擎：`engine.js`（`WatermelonEngine`，动态下落池难度曲线、搜刮身价、连击算法与状态机）
  - 游戏元数据与配置：`manifest.js`（自描述配置与大厅战绩展示适配）
- **游戏 3：极速反应挑战 (Reaction)**：`miniprogram/games/reaction/`
  - 纯 JS 核心逻辑引擎：`engine.js`（`ReactionEngine`，管理状态机、目标生成、计分连击与回调事件）
  - 游戏元数据与配置：`manifest.js`（自描述配置与大厅战绩展示适配）
- **游戏 4：舒尔特专注方格 (Schulte)**：`miniprogram/games/schulte/`
  - 纯 JS 核心逻辑引擎：`engine.js`（`SchulteEngine`，管理乱序洗牌、步进按序校验、0.1s 计时与评级算法）
  - 游戏元数据与配置：`manifest.js`（自描述配置与大厅战绩展示适配）

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
  - 职责定位：占位页面（施工与方案对齐中）。
- **页面 2：合成大西瓜**：`miniprogram/pages/watermelon/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`、`index.json`
  - 职责定位：高性能 Canvas 2D 控制器，零 setData 渲染主循环，Retina DPR 缩放适配，正圆图片贴图真实旋转滚落，接入通用弹窗组件与触感反馈。
- **页面 3：极速反应挑战**：`miniprogram/pages/game/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 职责定位：薄视图控制器（View Controller），事件转接至 `ReactionEngine`，接入通用弹窗组件。
- **页面 4：舒尔特专注方格**：`miniprogram/pages/schulte/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 职责定位：薄视图控制器（View Controller），事件转接至 `SchulteEngine`，接入通用弹窗组件。

## 工具库与数据层
- **触感与交互反馈 (Feedback)**：`miniprogram/utils/feedback.js`
  - 核心能力：自动识别开发者工具环境（`devtools` 跳过马达调用消除卡顿）、真机硬件震动适配、读取 `settings.vibrationEnabled` 用户配置。
- **本地存储管理 (Storage)**：`miniprogram/utils/storage.js`
  - 玩家配置：`getUserProfile`, `setUserProfile`
  - 游戏命名空间隔离存储：`getGameRecord(gameId)`, `saveGameRecord(gameId, data)`, `recordGamePlay(gameId, options)`
  - 兼容战绩持久化：`recordReactionResult`, `recordSchulteResult`, `getTodayRecord`, `getGameStats`
  - 系统偏好：`getSettings`, `saveSettings`
  - 存储清空：`clearAll`
- **道具全局管理器 (ItemManager)**：`miniprogram/utils/itemManager.js`
  - 核心能力：`LEVEL_THEMES` 1~6 级主题与颜色枚举（底色/高光/渐变）、全局 `itemMap` 双键索引（按 ID 与名称 O(1) 检索）、1~6 级专属双键 Map（`level1Map` ~ `level6Map`）与身价降序列表、道具对象内置 `priceFormatted` 千分位金额与 `theme` 主题、按等级随机抽取 `getRandomByLevel`。
- **战术地图背景管理器 (MapManager)**：`miniprogram/utils/mapManager.js`
  - 核心能力：6 大战术地图双键索引（按 Key 与名称 O(1) 检索）、开局独立战术背景会话（`pickSession` 随机抽取 96 张官方切片之一）、Canvas 2D 独立渲染适配（`drawBackground`，自带图象内存缓存、深色遮罩与军事经纬十字刻度）、DOM 样式生成器（`getRandomBackgroundStyle`，供非 Canvas 页面一键绑定）。
- **三角洲战术物资资源库**：
  - 地图底图资源目录：`miniprogram/assets/maps/`（6大核心战术地图 1024x1024 纯净底图，总体积 760KB）
  - 地图元数据清单：`miniprogram/assets/maps/map_manifest.json`
  - 图标资源分级目录：`miniprogram/assets/icons/`
    - 物资与搜集容器：`miniprogram/assets/icons/containers/` (30 个)
    - 出生点：`miniprogram/assets/icons/spawns/` (1 个)
    - 撤离点：`miniprogram/assets/icons/extractions/` (9 个)
    - 任务与接取站：`miniprogram/assets/icons/tasks/` (2 个)
    - 首领Boss：`miniprogram/assets/icons/bosses/` (1 个)
    - 特种/辐射设施：`miniprogram/assets/icons/facilities/` (14 个)
  - 分类索引清单：`miniprogram/assets/icons/icon_manifest.json`
  - 稀有度等级图标与样式：`miniprogram/assets/icons/levels/` (红/橙/紫/蓝/绿/白 6 级图标雪碧图与 `level_icons.wxss`)
  - 道具高清图片与元数据：`miniprogram/assets/items/`
    - 收藏品 (270件)：`miniprogram/assets/items/collection/`
    - 消耗品 (30件)：`miniprogram/assets/items/consume/`
    - 门卡 (59件)：`miniprogram/assets/items/keys/`
    - 道具元数据清单：`miniprogram/assets/items/item_manifest.json`（纯简体规范化轻量清单，总计 359 件核心道具）
  - 数据爬取、价格同步与导出脚本：`scripts/verify_game_architecture.js`、`scripts/verify_watermelon_physics.js`、`scripts/migrate_to_official_cdn.js`、`scripts/simplify_item_manifest.js`、`scripts/update_item_prices.js`、`scripts/lib/opencc.js`、`scripts/lib/zhou_pack_decoder.js`、`scripts/crawl_delta_items.js`、`scripts/generate_maps.ps1`、`scripts/download_icons.js`、`scripts/scan_df_data.js`

## 文档与 AI 技能
- 官方框架精简指南与排错手册：`docs/miniprogram-framework.md`
- MCP 配置文件：`.mcp.json`
- CloudBase 技能库：`.claude/skills/cloudbase/`
