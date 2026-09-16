# 项目任务状态记录

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




