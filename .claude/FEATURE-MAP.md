# 功能实现与路径索引 (FEATURE-MAP.md)

## 核心配置与入口
- 全局配置与路由：`miniprogram/app.json`
- 全局应用入口：`miniprogram/app.js`
- 全局样式：`miniprogram/app.wxss`
- 开发者工具配置：`project.config.json`、`project.private.config.json`

## 业务模块与页面
- **游戏大厅 / 入口汇集**：`miniprogram/pages/index/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 核心能力：游戏合集列表入口、玩家头像（`chooseAvatar`）与昵称（`type="nickname"`）管理、今日局数与金币看板、点击卡片进入对应小游戏、全局音效/震动开关、数据重置。
- **游戏 1：极速反应挑战**：`miniprogram/pages/game/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 核心能力：3x3 九宫格动态反应打靶、30s 倒计时、连击倍率（Combo）、轻触与错误震动反馈、游戏结算与最高分更新。
- **游戏 2：舒尔特专注方格**：`miniprogram/pages/schulte/`
  - 视图逻辑：`index.wxml`、`index.wxss`、`index.js`
  - 核心能力：4x4 乱序方格、1-16 升序扫视点击、0.1 秒高精度计时、通关专注力评级（王者/极佳/优秀/良好）、最佳用时记录保存。

## 工具库与数据层
- **本地存储管理 (Storage)**：`miniprogram/utils/storage.js`
  - 玩家配置：`getUserProfile`, `setUserProfile`
  - 战绩持久化：`recordReactionResult`, `recordSchulteResult`, `getTodayRecord`, `getGameStats`
  - 系统偏好：`getSettings`, `saveSettings`
  - 存储清空：`clearAll`
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
  - 数据爬取与导出脚本：`scripts/generate_maps.ps1`、`scripts/download_icons.js`、`scripts/scan_df_data.js`

## 文档与 AI 技能
- 官方框架精简指南与排错手册：`docs/miniprogram-framework.md`
- MCP 配置文件：`.mcp.json`
- CloudBase 技能库：`.claude/skills/cloudbase/`
