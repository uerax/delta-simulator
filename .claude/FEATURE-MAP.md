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

## 文档与 AI 技能
- 官方框架精简指南与排错手册：`docs/miniprogram-framework.md`
- MCP 配置文件：`.mcp.json`
- CloudBase 技能库：`.claude/skills/cloudbase/`
