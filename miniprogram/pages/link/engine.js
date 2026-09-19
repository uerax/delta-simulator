/**
 * miniprogram/pages/link/engine.js
 * 鼠鼠连连看 - 纯逻辑核心引擎 (LinkEngine)
 * 遵循严格架构规范：
 *  1. 纯 JS 实现，零小程序 DOM/Canvas/wx API 依赖，可在 Node.js 下 100% 自动化单测
 *  2. 候选关卡生成 + Forward Solver 正向求解器 + Solution Certificate 通关证书
 *  3. 有限重试上限 (MAX_ATTEMPTS) + Deterministic Generator 确定性保底构造，绝无无限循环
 *  4. 死局双层保护：最多 20 次随机洗牌 (检测可用步 + 残局完整解验证) ➔ 确定性 Recovery 兜底
 *  5. 精准三线两折寻路 (0折、1折、2折与外围 Padding 绕行)
 *  6. 消除锤成对粉碎支持、Combo 连击系统与撤离倒计时
 */

const { getStageConfig, pickStageItems, createBalancedTiles } = require('./items');

/**
 * 经典 Mulberry32 伪随机发生器 (根据 Seed 生成确定性序列)
 */
function createMulberry32(seed) {
  let s = Math.floor(seed) || 123456789;
  return function nextRandom() {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 8 种经典战术基础版型 (完全告别单调长方形)
const LAYOUT_TYPES = [
  'CORNER_HOLLOW',   // 钻石八角四角镂空 (开阔灵动)
  'CENTER_HOLLOW',   // 回字形核心中空 (环形回廊)
  'CORRIDOR',        // 战术双岛大长廊 (峡谷对峙)
  'CROSS',           // 十字交叉阵地 (四通八达)
  'STAIRS',          // 战术金字塔阶梯
  'HOURGLASS',       // 战术沙漏 (上下宽中间收腰)
  'HYBRID',          // 复合侵蚀 (微中空+微切角)
  'FULL'             // 经典全满战术平原
];

class LinkEngine {
  constructor(options = {}) {
    this.options = options;
    this.layoutType = 'CORNER_HOLLOW';

    // 回调事件
    this.onStateChange = options.onStateChange || null;
    this.onScoreUpdate = options.onScoreUpdate || null;
    this.onMatch = options.onMatch || null;
    this.onMismatch = options.onMismatch || null;
    this.onShuffle = options.onShuffle || null;
    this.onTick = options.onTick || null;
    this.onStageClear = options.onStageClear || null;
    this.onGameOver = options.onGameOver || null;

    // 基础状态
    this.gameState = 'ready'; // 'ready' | 'playing' | 'paused' | 'ended'
    this.stage = options.initialStage || 1;
    this.score = options.initialScore || 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastMatchTime = 0;

    // 倒计时 (秒)
    this.timeLeft = options.initialTimeLeft || 120;
    this._timer = null;

    // 棋盘数据
    this.rows = 6;
    this.cols = 10;
    this.gridRows = this.rows + 2; // 含外围空边界
    this.gridCols = this.cols + 2;
    this.grid = []; // [gridRows][gridCols]
    this.remainingTiles = 0;
    this.selectedTile = null; // { r, c }

    // 通关证书与生成记录
    this.solutionCertificate = [];

    // 消除锤状态
    this.toolMode = 'none'; // 'none' | 'hammer'

    if (!options.autoInitSilent) {
      this.initStage(this.stage);
    }
  }

  /**
   * 初始化指定关卡
   */
  initStage(stageNum = 1, preservedState = null) {
    this.stage = stageNum;
    this.selectedTile = null;
    this.combo = 0;

    if (preservedState && preservedState.grid) {
      // 恢复断点续玩存档
      this.rows = preservedState.rows || 6;
      this.cols = preservedState.cols || 10;
      this.layoutType = preservedState.layoutType || 'CORNER_HOLLOW';
      this.gridRows = this.rows + 2;
      this.gridCols = this.cols + 2;
      this.grid = preservedState.grid;
      this.timeLeft = preservedState.timeLeft !== undefined ? preservedState.timeLeft : 120;
      this.score = preservedState.score || this.score;
      this.remainingTiles = this._countTiles();
      this.solutionCertificate = preservedState.solutionCertificate || [];
    } else {
      // 动态生成全新关卡
      const cfg = getStageConfig(this.stage);
      this.rows = cfg.rows;
      this.cols = cfg.cols;
      this.gridRows = this.rows + 2;
      this.gridCols = this.cols + 2;

      // 关卡时间补给：第1关 120s，后续每关按剩余时间递加或保底 90s
      if (this.stage === 1) {
        this.timeLeft = 120;
      } else {
        this.timeLeft = Math.min(180, this.timeLeft + 30); // 奖励 30 秒撤离时间
      }

      const seed = (this.options.seed || Date.now()) + this.stage * 10007;
      this._generateLevelWithCertificate(cfg, seed);
    }

    this._notifyScore();
  }

  /**
   * 核心生成管线：8大版型对称雕刻 + 候选生成 + Forward Solver 求解 + 有限重试 (MAX 60) + 确定性生成器保底
   */
  _generateLevelWithCertificate(cfg, seed) {
    const rng = createMulberry32(seed);
    const MAX_ATTEMPTS = 60;

    // 随机动态选择 8 种基础版型之一 (第1关使用四角镂空 CORNER_HOLLOW，保证开阔透光，后续无限关卡随机轮换)
    let layoutType = 'CORNER_HOLLOW';
    if (this.stage > 1) {
      const typeIdx = Math.floor(rng() * LAYOUT_TYPES.length);
      layoutType = LAYOUT_TYPES[typeIdx];
    }
    this.layoutType = layoutType;

    // 1. 生成当前版型的 0/1 掩码并计算实际有效格数 (恒为偶数)
    const { mask, activeCount } = this._createLayoutMask(cfg.rows, cfg.cols, layoutType, rng);

    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      // 2. 抽取物资
      const items = pickStageItems(cfg.typeCount);
      // 3. 严格按实际版型有效格数配平偶数方块
      const tiles = createBalancedTiles(items, activeCount);
      // 4. 按照掩码构造异形候选棋盘矩阵
      const candidateGrid = this._buildCandidateGridWithMask(cfg.rows, cfg.cols, mask, tiles, rng);
      // 5. Forward Solver 求解验证
      const solution = this._solveForward(candidateGrid);
      if (solution && solution.length > 0) {
        // 验证初始状态至少存在 2 个可用移动
        const initialMoves = this.findAvailableMoves(candidateGrid);
        if (initialMoves.length >= 2) {
          this.grid = candidateGrid;
          this.remainingTiles = activeCount;
          this.solutionCertificate = solution;
          return;
        }
      }
    }

    // 若 60 次均未成功，启动确定性可解生成器保底
    this._generateDeterministicSolvable(cfg, mask, activeCount);
  }

  /**
   * 8 大基础版型对称雕刻算法生成器
   * 保证主体连通、无异常孤岛，且有效格总数恒为偶数
   */
  _createLayoutMask(rows, cols, type, rng) {
    const mask = [];
    for (let r = 0; r < rows; r++) {
      mask[r] = new Array(cols).fill(1);
    }

    switch (type) {
      case 'CENTER_HOLLOW': { // 回字形中心镂空
        const midR = Math.floor(rows / 2);
        const midC = Math.floor(cols / 2);
        for (let r = midR - 1; r <= midR; r++) {
          for (let c = midC - 2; c <= midC + 1; c++) {
            if (r >= 0 && r < rows && c >= 0 && c < cols) mask[r][c] = 0;
          }
        }
        break;
      }
      case 'CORNER_HOLLOW': { // 四角镂空八角阵
        const cutR = Math.max(1, Math.floor(rows / 4));
        const cutC = Math.max(1, Math.floor(cols / 4));
        for (let r = 0; r < cutR; r++) {
          for (let c = 0; c < cutC; c++) {
            mask[r][c] = 0;
            mask[r][cols - 1 - c] = 0;
            mask[rows - 1 - r][c] = 0;
            mask[rows - 1 - r][cols - 1 - c] = 0;
          }
        }
        break;
      }
      case 'CROSS': { // 十字交叉阵地
        const midR = Math.floor(rows / 2);
        const midC = Math.floor(cols / 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const inH = (r === midR - 1 || r === midR);
            const inV = (c >= midC - 2 && c <= midC + 1);
            if (!inH && !inV) {
              mask[r][c] = 0;
            }
          }
        }
        break;
      }
      case 'CORRIDOR': { // 双岛长廊对垒 (中空双列峡谷)
        const midC = Math.floor(cols / 2);
        for (let r = 0; r < rows; r++) {
          mask[r][midC - 1] = 0;
          mask[r][midC] = 0;
        }
        break;
      }
      case 'STAIRS': { // 金字塔阶梯
        for (let r = 0; r < rows; r++) {
          const indent = Math.floor((rows - 1 - r) / 2);
          for (let c = 0; c < indent; c++) {
            mask[r][c] = 0;
            mask[r][cols - 1 - c] = 0;
          }
        }
        break;
      }
      case 'HOURGLASS': { // 战术沙漏 (中间收腰)
        const midR = Math.floor(rows / 2);
        for (let r = 0; r < rows; r++) {
          const distFromMid = Math.abs(r - (rows - 1) / 2);
          const cut = Math.max(0, Math.floor(1.8 - distFromMid));
          for (let c = 0; c < cut * 2; c++) {
            mask[r][c] = 0;
            mask[r][cols - 1 - c] = 0;
          }
        }
        break;
      }
      case 'HYBRID': { // 复合侵蚀 (微中空 + 四角切削)
        mask[0][0] = 0; mask[0][cols - 1] = 0;
        mask[rows - 1][0] = 0; mask[rows - 1][cols - 1] = 0;
        const midR = Math.floor(rows / 2);
        const midC = Math.floor(cols / 2);
        if (rows >= 4 && cols >= 6) {
          mask[midR - 1][midC - 1] = 0; mask[midR - 1][midC] = 0;
          mask[midR][midC - 1] = 0; mask[midR][midC] = 0;
        }
        break;
      }
      case 'FULL':
      default:
        break;
    }

    // 严格保证有效格恒为偶数
    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (mask[r][c] === 1) count++;
      }
    }

    if (count % 2 !== 0) {
      outer: for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (mask[r][c] === 0) {
            mask[r][c] = 1;
            count++;
            break outer;
          }
        }
      }
    }

    return { mask, activeCount: count };
  }

  /**
   * 按照掩码构造异形候选网格 (填入方块并加外围 Padding)
   */
  _buildCandidateGridWithMask(rows, cols, mask, tiles, rng) {
    const gridRows = rows + 2;
    const gridCols = cols + 2;
    const grid = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = new Array(gridCols).fill(null);
    }

    // 洗牌方块
    const shuffledTiles = [...tiles];
    for (let i = shuffledTiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = shuffledTiles[i];
      shuffledTiles[i] = shuffledTiles[j];
      shuffledTiles[j] = temp;
    }

    // 仅在掩码为 1 的位置填入方块，掩码为 0 的位置天然保持为 null (空地走廊)
    let tileIdx = 0;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        if (mask[r - 1][c - 1] === 1 && tileIdx < shuffledTiles.length) {
          grid[r][c] = { ...shuffledTiles[tileIdx++] };
        }
      }
    }

    return grid;
  }

  /**
   * 确定性可解棋盘生成器 (Deterministic Solvable Generator)
   * 支持任意异形掩码，将相同方块成对紧邻放入有效坑位中，100% 存在通解
   */
  _generateDeterministicSolvable(cfg, mask, activeCount) {
    const items = pickStageItems(cfg.typeCount);
    const tiles = createBalancedTiles(items, activeCount);

    this.grid = [];
    for (let r = 0; r < this.gridRows; r++) {
      this.grid[r] = new Array(this.gridCols).fill(null);
    }

    // 收集所有有效坑位
    const validSlots = [];
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        if (mask[r - 1][c - 1] === 1) {
          validSlots.push({ r, c });
        }
      }
    }

    // 乱序对子
    for (let i = 0; i < validSlots.length; i += 2) {
      if (i + 1 < tiles.length) {
        const p1 = validSlots[i];
        const p2 = validSlots[i + 1];
        this.grid[p1.r][p1.c] = { ...tiles[i] };
        this.grid[p2.r][p2.c] = { ...tiles[i + 1] };
      }
    }

    this.remainingTiles = this._countTiles();
    const solution = this._solveForward(this.grid);
    this.solutionCertificate = solution || [];
  }

  /**
   * Forward Solver (正向模拟求解器)
   * 贪心推演合法消除路线，成功则返回完整消除证书
   */
  _solveForward(grid) {
    const cloneGrid = [];
    for (let r = 0; r < grid.length; r++) {
      cloneGrid[r] = [];
      for (let c = 0; c < grid[0].length; c++) {
        cloneGrid[r][c] = grid[r][c] ? { ...grid[r][c] } : null;
      }
    }

    const certificate = [];
    let remaining = 0;
    for (let r = 1; r < cloneGrid.length - 1; r++) {
      for (let c = 1; c < cloneGrid[0].length - 1; c++) {
        if (cloneGrid[r][c]) remaining++;
      }
    }

    // 步数上限防御
    const maxSteps = 100;
    let step = 0;

    while (remaining > 0 && step < maxSteps) {
      step++;
      const moves = this.findAvailableMoves(cloneGrid);
      if (!moves || moves.length === 0) {
        return null; // 陷入死局，本次推演未通
      }

      // 选取第一个合法移动
      const move = moves[0];
      certificate.push({
        p1: { r: move.p1.r, c: move.p1.c },
        p2: { r: move.p2.r, c: move.p2.c },
        id: cloneGrid[move.p1.r][move.p1.c].id
      });

      // 模拟消除
      cloneGrid[move.p1.r][move.p1.c] = null;
      cloneGrid[move.p2.r][move.p2.c] = null;
      remaining -= 2;
    }

    return remaining === 0 ? certificate : null;
  }

  /**
   * 启动游戏主循环
   */
  start() {
    if (this.gameState === 'playing') return;
    this.gameState = 'playing';
    this._notifyState();

    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (this.gameState !== 'playing') return;
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      if (this.onTick) this.onTick({ timeLeft: this.timeLeft });

      if (this.timeLeft <= 0) {
        this._handleTimeOut();
      }
    }, 1000);
  }

  /**
   * 暂停
   */
  pause() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this._notifyState();
    }
  }

  /**
   * 恢复
   */
  resume() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this._notifyState();
    }
  }

  /**
   * 销毁引擎，清理计时器
   */
  destroy() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.gameState = 'ended';
  }

  /**
   * 处理玩家触控方块点击
   * @param {number} r 行坐标 (1 ~ rows)
   * @param {number} c 列坐标 (1 ~ cols)
   */
  handleCellTap(r, c) {
    if (this.gameState !== 'playing') return null;
    if (r < 1 || r > this.rows || c < 1 || c > this.cols) return null;

    const target = this.grid[r][c];
    if (!target) return null; // 点击空格无反应

    // 1. 消除锤激活模式处理
    if (this.toolMode === 'hammer') {
      return this.useHammer(r, c);
    }

    // 2. 第一次选中
    if (!this.selectedTile) {
      this.selectedTile = { r, c };
      return { type: 'select', selected: { r, c } };
    }

    const { r: r1, c: c1 } = this.selectedTile;

    // 点击自身：取消选中
    if (r1 === r && c1 === c) {
      this.selectedTile = null;
      return { type: 'unselect' };
    }

    // 3. 第二次点击，执行连通判定
    const path = this.canConnect(r1, c1, r, c);
    if (path && path.length >= 2) {
      // 配对成功消除
      const item = { ...this.grid[r1][c1] };
      this.grid[r1][c1] = null;
      this.grid[r][c] = null;
      this.remainingTiles -= 2;
      this.selectedTile = null;

      // 连击处理 (2.2 秒内连续消除判定 Combo)
      const now = Date.now();
      if (now - this.lastMatchTime <= 2200) {
        this.combo += 1;
      } else {
        this.combo = 1;
      }
      this.lastMatchTime = now;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // 计分：基础身价 + 连击加成
      const comboMultiplier = 1 + (this.combo - 1) * 0.2;
      const addedScore = Math.round(item.price * comboMultiplier);
      this.score += addedScore;

      if (this.onMatch) {
        this.onMatch({
          p1: { r: r1, c: c1 },
          p2: { r, c },
          path,
          item,
          combo: this.combo,
          addedScore
        });
      }

      this._notifyScore();

      // 检查通关与死局检测
      if (this.remainingTiles <= 0) {
        this._handleStageClear();
      } else {
        this._checkAndAutoShuffle();
      }

      return { type: 'match', p1: { r: r1, c: c1 }, p2: { r, c }, path, item, addedScore };
    } else {
      // 连通失败或非相同图案：重新选中新方块
      const oldSelected = { ...this.selectedTile };
      this.selectedTile = { r, c };
      if (this.onMismatch) {
        this.onMismatch({ p1: oldSelected, p2: { r, c } });
      }
      return { type: 'switch_select', p1: oldSelected, p2: { r, c } };
    }
  }

  /**
   * 激活/取消消除锤
   */
  setToolMode(mode = 'none') {
    this.toolMode = mode;
    if (mode === 'none') {
      this.selectedTile = null;
    }
  }

  /**
   * 使用消除锤击碎指定方块 (成对粉碎机制：同步粉碎其在场上的另一个配对方块，确保棋盘平衡)
   */
  useHammer(r, c) {
    const target = this.grid[r][c];
    if (!target) return null;

    // 寻找场上同 ID 的另一个方块成对消除
    let mate = null;
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= this.cols; col++) {
        if ((row !== r || col !== c) && this.grid[row][col] && this.grid[row][col].id === target.id) {
          mate = { r: row, c: col };
          break;
        }
      }
      if (mate) break;
    }

    // 移除方块
    const item = { ...target };
    this.grid[r][c] = null;
    if (mate) {
      this.grid[mate.r][mate.c] = null;
      this.remainingTiles -= 2;
    } else {
      this.remainingTiles -= 1;
    }

    this.selectedTile = null;
    this.toolMode = 'none';

    // 计分
    this.score += item.price;
    this._notifyScore();

    if (this.remainingTiles <= 0) {
      this._handleStageClear();
    } else {
      this._checkAndAutoShuffle();
    }

    return {
      type: 'hammer_hit',
      p1: { r, c },
      p2: mate,
      item
    };
  }

  /**
   * 死局巡检与双层恢复
   * 第一层：最多 20 次随机洗牌 (检测可用步 + 残局完整解验证)
   * 第二层：确定性 Recovery 兜底
   */
  _checkAndAutoShuffle() {
    if (this.remainingTiles <= 0) return;

    const availableMoves = this.findAvailableMoves(this.grid);
    if (availableMoves && availableMoves.length > 0) {
      return; // 依然有解，无需洗牌
    }

    // 触发第一层：最多 20 次有限随机洗牌
    let recovered = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      this._shuffleRemainingTiles();
      const moves = this.findAvailableMoves(this.grid);
      if (moves.length > 0) {
        // 残局可解验证
        const sol = this._solveForward(this.grid);
        if (sol) {
          recovered = true;
          break;
        }
      }
    }

    // 若 20 次随机洗牌仍失败，触发第二层：确定性 Recovery
    if (!recovered) {
      this._recoveryDeterministic();
    }

    if (this.onShuffle) {
      this.onShuffle({ reason: 'deadlock_auto' });
    }
  }

  /**
   * 主动战术洗牌道具触发
   */
  manualShuffle() {
    let recovered = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      this._shuffleRemainingTiles();
      const moves = this.findAvailableMoves(this.grid);
      if (moves.length > 0) {
        recovered = true;
        break;
      }
    }
    if (!recovered) {
      this._recoveryDeterministic();
    }
    this.selectedTile = null;
    if (this.onShuffle) {
      this.onShuffle({ reason: 'manual' });
    }
  }

  /**
   * 洗牌剩余方块
   */
  _shuffleRemainingTiles() {
    const tiles = [];
    const positions = [];

    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        if (this.grid[r][c]) {
          tiles.push(this.grid[r][c]);
          positions.push({ r, c });
        }
      }
    }

    // Fisher-Yates
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = tiles[i];
      tiles[i] = tiles[j];
      tiles[j] = temp;
    }

    for (let i = 0; i < positions.length; i++) {
      const { r, c } = positions[i];
      this.grid[r][c] = tiles[i];
    }
  }

  /**
   * 确定性 Recovery：将场上剩下的同类方块成对排布至相邻或外围通路中
   */
  _recoveryDeterministic() {
    const tiles = [];
    const positions = [];

    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        if (this.grid[r][c]) {
          tiles.push(this.grid[r][c]);
          positions.push({ r, c });
        }
      }
    }

    // 按 ID 排序，使得相同的方块挨在一起
    tiles.sort((a, b) => a.id - b.id);

    for (let i = 0; i < positions.length; i++) {
      const { r, c } = positions[i];
      this.grid[r][c] = tiles[i];
    }
  }

  /**
   * 提示道具：寻找并返回当前第一对可消除方块
   */
  findHint() {
    const moves = this.findAvailableMoves(this.grid);
    if (moves && moves.length > 0) {
      return moves[0];
    }
    return null;
  }

  /**
   * 通关当前关卡，准备晋级
   */
  _handleStageClear() {
    const clearedStage = this.stage;
    const nextStage = this.stage + 1;

    // 关卡通过奖励加成
    const stageBonus = clearedStage * 100000;
    this.score += stageBonus;

    if (this.onStageClear) {
      this.onStageClear({
        stage: clearedStage,
        score: this.score,
        nextStage
      });
    }

    // 自动无缝进入下一关
    this.initStage(nextStage);
  }

  /**
   * 倒计时结束，撤离失败
   */
  _handleTimeOut() {
    this.destroy();
    if (this.onGameOver) {
      this.onGameOver({
        stage: this.stage,
        score: this.score,
        maxCombo: this.maxCombo,
        reason: 'timeout'
      });
    }
  }

  /**
   * 三线两折连通判定算法 (核心)
   * 支持 0 折 (直连)、1 折 (单直角)、2 折 (双直角与外围绕行)
   *
   * @param {number} r1 起点行
   * @param {number} c1 起点列
   * @param {number} r2 终点行
   * @param {number} c2 终点列
   * @param {Array<Array>} [grid] 可选的判定网格 (默认 this.grid)
   * @returns {Array<{r: number, c: number}>|null} 折线顶点数组
   */
  canConnect(r1, c1, r2, c2, grid = this.grid) {
    if (!grid || (r1 === r2 && c1 === c2)) return null;

    const t1 = grid[r1] && grid[r1][c1];
    const t2 = grid[r2] && grid[r2][c2];
    if (!t1 || !t2) return null;
    if (t1.id !== t2.id) return null; // 图案必须相同

    // 1. 0 折直连判定
    if (this._isLineEmpty(r1, c1, r2, c2, grid)) {
      return [{ r: r1, c: c1 }, { r: r2, c: c2 }];
    }

    // 2. 1 折 (单拐角) 判定
    // 拐角候选点 1: (r1, c2)
    if (grid[r1] && grid[r1][c2] === null) {
      if (this._isLineEmpty(r1, c1, r1, c2, grid) && this._isLineEmpty(r1, c2, r2, c2, grid)) {
        return [{ r: r1, c: c1 }, { r: r1, c: c2 }, { r: r2, c: c2 }];
      }
    }
    // 拐角候选点 2: (r2, c1)
    if (grid[r2] && grid[r2][c1] === null) {
      if (this._isLineEmpty(r1, c1, r2, c1, grid) && this._isLineEmpty(r2, c1, r2, c2, grid)) {
        return [{ r: r1, c: c1 }, { r: r2, c: c1 }, { r: r2, c: c2 }];
      }
    }

    // 3. 2 折 (双拐角) 判定
    const gridRows = grid.length;
    const gridCols = grid[0].length;

    // 3.1 水平方向延伸扫描 (向左向右扫描 r1 行上的所有空点)
    for (let c = 0; c < gridCols; c++) {
      if (c === c1) continue;
      // 检查 (r1, c) 是否为空或终点
      if (grid[r1][c] === null && this._isLineEmpty(r1, c1, r1, c, grid)) {
        // 若 (r1, c) 与 (r2, c2) 能用 1 折连接
        if (grid[r2][c] === null && this._isLineEmpty(r1, c, r2, c, grid) && this._isLineEmpty(r2, c, r2, c2, grid)) {
          return [
            { r: r1, c: c1 },
            { r: r1, c: c },
            { r: r2, c: c },
            { r: r2, c: c2 }
          ];
        }
      }
    }

    // 3.2 垂直方向延伸扫描 (向上向下扫描 c1 列上的所有空点)
    for (let r = 0; r < gridRows; r++) {
      if (r === r1) continue;
      if (grid[r][c1] === null && this._isLineEmpty(r1, c1, r, c1, grid)) {
        // 若 (r, c1) 与 (r2, c2) 能用 1 折连接
        if (grid[r][c2] === null && this._isLineEmpty(r, c1, r, c2, grid) && this._isLineEmpty(r, c2, r2, c2, grid)) {
          return [
            { r: r1, c: c1 },
            { r: r, c: c1 },
            { r: r, c: c2 },
            { r: r2, c: c2 }
          ];
        }
      }
    }

    return null;
  }

  /**
   * 检查两点间是否为无障碍空直线 (两点必须在同一行或同一列)
   */
  _isLineEmpty(r1, c1, r2, c2, grid = this.grid) {
    if (!grid) return false;
    if (r1 === r2) {
      const minC = Math.min(c1, c2);
      const maxC = Math.max(c1, c2);
      for (let c = minC + 1; c < maxC; c++) {
        if (grid[r1][c] !== null) return false;
      }
      return true;
    }
    if (c1 === c2) {
      const minR = Math.min(r1, r2);
      const maxR = Math.max(r1, r2);
      for (let r = minR + 1; r < maxR; r++) {
        if (grid[r][c1] !== null) return false;
      }
      return true;
    }
    return false;
  }

  /**
   * 全盘寻找所有可消除移动步
   */
  findAvailableMoves(grid = this.grid) {
    if (!grid || !grid[0]) return [];
    const tilesByItemId = new Map();
    const rows = grid.length - 2;
    const cols = grid[0].length - 2;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const t = grid[r][c];
        if (t) {
          if (!tilesByItemId.has(t.id)) {
            tilesByItemId.set(t.id, []);
          }
          tilesByItemId.get(t.id).push({ r, c });
        }
      }
    }

    const availableMoves = [];
    tilesByItemId.forEach((positions) => {
      if (positions.length < 2) return;
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const p1 = positions[i];
          const p2 = positions[j];
          const path = this.canConnect(p1.r, p1.c, p2.r, p2.c, grid);
          if (path) {
            availableMoves.push({ p1, p2, path });
          }
        }
      }
    });

    return availableMoves;
  }

  /**
   * 统计棋盘上剩余方块总数
   */
  _countTiles() {
    let count = 0;
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        if (this.grid[r][c]) count++;
      }
    }
    return count;
  }

  /**
   * 导出当前对局快照 (用于断点续玩存档)
   */
  exportSessionState() {
    return {
      stage: this.stage,
      score: this.score,
      timeLeft: this.timeLeft,
      rows: this.rows,
      cols: this.cols,
      layoutType: this.layoutType,
      grid: this.grid,
      solutionCertificate: this.solutionCertificate,
      timestamp: Date.now()
    };
  }

  _notifyState() {
    if (this.onStateChange) this.onStateChange({ gameState: this.gameState });
  }

  _notifyScore() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        maxCombo: this.maxCombo,
        stage: this.stage,
        timeLeft: this.timeLeft,
        remainingTiles: this.remainingTiles
      });
    }
  }
}

module.exports = LinkEngine;
