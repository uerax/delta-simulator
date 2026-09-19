/**
 * 三角洲《合成大西瓜》- 工业级 Planck.js (Box2D 官方纯 JS 移植版) 物理世界适配器
 * 100% 对齐现有 PhysicsWorld 接口与 body 渲染契约
 *
 * 核心对标斗鱼 Cocos Creator 3.8.6 生产环境逆向参数：
 * 1. 摩擦系数 friction: 0.2
 * 2. 弹性系数 restitution: 0.1 (低弹性防弹跳)
 * 3. 线性阻尼 linearDamping: 0.12
 * 4. 角阻尼 angularDamping: 0.22 (防止空转自旋)
 * 5. 自动休眠 allowSleep: true (杜绝地面微幅蠕动与无限自旋)
 * 6. 靠下锚定算法 pickLowerFruit 与极微弱径向爆炸冲击波
 */

let planck = null;
let Vec2 = null;

/**
 * 惰性按需载入 290KB Planck.js 物理库
 * 遵循微信官方性能最佳实践：消除模块被 require 时同步解析大文件的阻塞，
 * 保证页面路由跳转在 0ms 瞬间派发，只有在物理世界真正构造时才按需加载。
 */
function ensurePlanck() {
  if (!planck) {
    const planckRaw = require('./planck.min.js');
    planck = (planckRaw && planckRaw.World) ? planckRaw : ((planckRaw && planckRaw.default) ? planckRaw.default : planckRaw);
    Vec2 = planck.Vec2 || (planckRaw && planckRaw.Vec2);
  }
  return planck;
}

const { getItemByLevel, MAX_LEVEL } = require('./items');

// 像素与米制转换比率：50 像素 = 1 米
const SCALE = 50;

class PhysicsWorldPlanck {
  constructor(options = {}) {
    ensurePlanck();
    this.width = options.width || 360;
    this.height = options.height || Math.round(this.width * (976 / 702)); // 严格 1:1 对标斗鱼官方 STAGE_LAYOUT (702:976)
    this.stageScale = this.width / 702; // 1:1 对标斗鱼官方 stageScale 响应式缩放系数
    this.gravity = options.gravity !== undefined ? options.gravity : 1300; // px/s^2 严格对标斗鱼 1:1 重力 (1300)
    this.dangerY = options.dangerY !== undefined ? options.dangerY : Math.round(this.height * 0.125); // 对标斗鱼警戒线比例
    this.dangerDwellTime = options.dangerDwellTime || 0.8;

    this.onMerge = options.onMerge || null;
    this.onDangerLineTrigger = options.onDangerLineTrigger || null;
    this.onDangerWarning = options.onDangerWarning || null;

    this.isWarning = false;
    this.bodies = [];
    this.nextId = 1;
    this._mergePairs = [];
    this._accumulator = 0; // 120Hz 物理步进累加器 (严格对标斗鱼 fixedTimeStep: 1/120)
    this._mergeScanTimer = 0; // 50ms 空间兜底扫描计时器 (对标斗鱼 mergeScanTimer)

    // 初始化 Planck.js 物理世界 (重力在屏幕坐标系下 Y 轴向下为正)
    const gravityMeter = this.gravity / SCALE;
    this.world = new planck.World(new Vec2(0, gravityMeter));

    // 创建场地三面静态边界 (底、左、右)
    this._createBoundaries();

    // 监听物理碰撞事件
    this._setupContactListener();
  }

  /**
   * 创建场地三面静态碰撞刚体 (1:1 对标斗鱼 Cocos createStaticBoxCollider 实体多边形挡板)
   */
  _createBoundaries() {
    const widthMeter = this.width / SCALE;
    const heightMeter = this.height / SCALE;
    const wallThick = 0.4; // 20px 厚实体碰撞盒，彻底消灭零厚度 Edge 单线段穿模风险

    this.groundBody = this.world.createBody();

    // 地面实体碰撞盒
    this.groundBody.createFixture(planck.Box(widthMeter / 2, wallThick / 2, new Vec2(widthMeter / 2, heightMeter + wallThick / 2)), {
      friction: 0.2,
      restitution: 0.1
    });

    // 左墙实体碰撞盒
    this.groundBody.createFixture(planck.Box(wallThick / 2, heightMeter / 2, new Vec2(-wallThick / 2, heightMeter / 2)), {
      friction: 0.2,
      restitution: 0.1
    });

    // 右墙实体碰撞盒
    this.groundBody.createFixture(planck.Box(wallThick / 2, heightMeter / 2, new Vec2(widthMeter + wallThick / 2, heightMeter / 2)), {
      friction: 0.2,
      restitution: 0.1
    });
  }

  /**
   * 注册碰撞接触监听器 (1:1 严格对标斗鱼 Cocos onFruitContact，纯物理仿真绝无人工干预推力)
   */
  _setupContactListener() {
    this.world.on('begin-contact', (contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const bA = fA ? fA.getUserData() : null;
      const bB = fB ? fB.getUserData() : null;

      if (!bA || !bB) return;
      if (bA.isMerging || bB.isMerging) return;
      if (bA.isStatic || bB.isStatic) return;

      // 仅同等级水果且未达最高等级触发合成 (1:1 斗鱼 onFruitContact)
      if (bA.level === bB.level && bA.level < MAX_LEVEL) {
        this._tryQueueMerge(bA, bB);
      }
    });
  }

  /**
   * 尝试将碰撞对加入合成队列 (1:1 严格对标斗鱼 Cocos tryQueueMerge)
   */
  _tryQueueMerge(b1, b2) {
    if (b1.isMerging || b2.isMerging) return;

    // 即时加锁，防止同一帧内同一个刚体被多个接触事件重复入队 (1:1 斗鱼 s.merging = true)
    b1.isMerging = true;
    b2.isMerging = true;
    this._mergePairs.push({ b1, b2 });
  }

  /**
   * 创建并加入一个物理圆形刚体
   */
  createBody(level, x, y, options = {}) {
    const item = getItemByLevel(level, this.width);
    if (!item) return null;

    const radius = item.radius;
    const radiusMeter = radius / SCALE;
    const xMeter = x / SCALE;
    const yMeter = y / SCALE;
    const vxMeter = (options.vx || 0) / SCALE;
    const vyMeter = (options.vy || 0) / SCALE;

    const initAngle = options.angle || 0;
    const initAngularVelocity = options.angularVelocity || 0;
    const initBullet = options.bullet !== undefined ? options.bullet : true;

    // 创建 Planck 动态刚体 (严格 1:1 对标斗鱼 Cocos Fruit2.ts 逆向参数)
    const pBody = this.world.createDynamicBody({
      position: new Vec2(xMeter, yMeter),
      angle: initAngle,
      linearVelocity: new Vec2(vxMeter, vyMeter),
      angularVelocity: initAngularVelocity,
      linearDamping: 0.12,   // 严格 1:1 对标斗鱼 Fruit2.ts 逆向参数 0.12，恢复轻盈落体与自然重力势能
      angularDamping: 0.22,  // 严格 1:1 对标斗鱼 Fruit2.ts 逆向参数 0.22，恢复自然滚动与摩擦
      allowSleep: true,      // 开启休眠，彻底避免微幅自转与持续计算
      bullet: initBullet     // 动态 CCD：下落防穿模，沉降后关闭杜绝真机卡死
    });

    // 创建圆形碰撞夹具 (Fixture)
    const fixture = pBody.createFixture(planck.Circle(radiusMeter), {
      density: 1.0,
      friction: 0.2,         // 1:1 斗鱼 Cocos 摩擦力 0.2
      restitution: 0.1       // 1:1 斗鱼 Cocos 弹性 0.1
    });

    const body = {
      id: this.nextId++,
      level: level,
      radius: radius,
      mass: item.mass,
      x: x,
      y: y,
      vx: options.vx || 0,
      vy: options.vy || 0,
      angle: initAngle,
      angularVelocity: initAngularVelocity,
      restitution: 0.1,
      friction: 0.2,
      linearDamping: 0.12,
      angularDamping: 0.22,
      isStatic: !!options.isStatic,
      isMerging: false,
      isSleeping: false,
      age: 0,
      dangerTime: 0,
      _pBody: pBody
    };

    pBody.setUserData(body);
    fixture.setUserData(body);
    this.bodies.push(body);

    return body;
  }

  /**
   * 唤醒特定刚体
   */
  wakeBody(b) {
    if (b && b._pBody) {
      b._pBody.setAwake(true);
      b.isSleeping = false;
    }
  }

  /**
   * 唤醒指定中心点与半径范围内的所有休眠刚体，使其受重力自然沉降碰撞
   * @param {number} cx 中心 X 坐标
   * @param {number} cy 中心 Y 坐标
   * @param {number} radius 唤醒影响半径 (像素)
   */
  wakeBodiesInRadius(cx, cy, radius) {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b || b.isMerging || !b._pBody) continue;

      const dist = Math.hypot(b.x - cx, b.y - cy);
      if (dist <= radius + b.radius) {
        this.wakeBody(b);
      }
    }
  }

  /**
   * 根据屏幕像素坐标查找命中的水果刚体 (欧氏距离小于等于半径且距离最近)
   * 排除正在合成 (isMerging) 或无物理刚体的小球
   * @param {number} x
   * @param {number} y
   * @returns {object|null}
   */
  findBodyAt(x, y) {
    let target = null;
    let minDistance = Infinity;

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b || b.isMerging || !b._pBody) continue;

      const dist = Math.hypot(b.x - x, b.y - y);
      if (dist <= b.radius && dist < minDistance) {
        target = b;
        minDistance = dist;
      }
    }

    return target;
  }

  /**
   * 移除特定刚体
   */
  removeBody(body) {
    const index = this.bodies.indexOf(body);
    if (index !== -1) {
      this.bodies.splice(index, 1);
    }
    if (body && body._pBody) {
      try {
        this.world.destroyBody(body._pBody);
      } catch (e) {
        // 容错销毁
      }
      body._pBody = null;
    }
  }

  /**
   * 清空所有刚体
   */
  clear() {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b && b._pBody) {
        try {
          this.world.destroyBody(b._pBody);
        } catch (e) {}
        b._pBody = null;
      }
    }
    this.bodies = [];
    this._mergePairs = [];
    this.isWarning = false;
    this._accumulator = 0;
  }

  /**
   * 物理主步进更新 (1:1 严格对标斗鱼 Cocos 物理调度)
   * @param {number} dt 秒为单位的帧间隔时间 (如 0.016s)
   */
  update(dt = 0.016) {
    const clampedDt = Math.max(0.001, Math.min(dt, 0.033));

    // 1. 严格 1:1 对标斗鱼 Cocos 物理引擎调度：120Hz 固定步长累加器，每帧最多 2 个子步进
    const FIXED_DT = 1 / 120;
    this._accumulator += clampedDt;
    let subSteps = 0;
    while (this._accumulator >= FIXED_DT && subSteps < 2) {
      // 18 次速度迭代，24 次位置迭代，消除碰撞发呆与穿模
      this.world.step(FIXED_DT, 18, 24);
      this._accumulator -= FIXED_DT;
      subSteps++;
    }
    // 限制残余累加时间，防止掉帧后螺旋追帧
    if (this._accumulator > FIXED_DT) {
      this._accumulator = 0;
    }

    const heightMeter = this.height / SCALE;

    // 2. 将 Planck.js 物理刚体的位置与姿态同步回渲染层 body (1:1 严格对标斗鱼 Cocos 原生物理驱动，零人工干预)
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b._pBody || b.isMerging) continue;

      // 动态 CCD 策略：小球下落减速沉降后关闭 bullet，彻底杜绝密集堆叠下的 TOI 级联计算卡死
      if (b._pBody.isBullet() && (b.age > 0.6 || Math.abs(b.vy) < 120)) {
        b._pBody.setBullet(false);
      }

      const syncPos = b._pBody.getPosition();
      const syncLv = b._pBody.getLinearVelocity();

      b.x = syncPos.x * SCALE;
      b.y = syncPos.y * SCALE;
      b.vx = syncLv.x * SCALE;
      b.vy = syncLv.y * SCALE;
      b.angle = b._pBody.getAngle();
      b.angularVelocity = b._pBody.getAngularVelocity();
      b.isSleeping = !b._pBody.isAwake();
    }

    // 3. 存活时间与警戒线检测 (对标斗鱼 0.8s 稳定滞留模型)
    this._checkDangerAndAge(clampedDt);

    // 4. 兜底扫描：接触丢失兜底扫描 (1:1 严格对标斗鱼 Cocos scanProximityMergeCandidates，每 50ms 周期执行)
    this._scanProximityMerges(clampedDt);

    // 5. 执行合成消除与新球生成 (1:1 严格对标斗鱼 Cocos resolveMergeQueue)
    if (this._mergePairs.length > 0) {
      const pairsToProcess = this._mergePairs.slice();
      this._mergePairs.length = 0;
      this._resolveMerges(pairsToProcess);
    }
  }

  /**
   * 存活时间与顶部警戒线死亡检测 (对标斗鱼 0.8s 稳定滞留模型)
   */
  _checkDangerAndAge(dt) {
    let anyInDanger = false;

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.isMerging) continue;

      b.age += dt;

      // 仅对存活超过 1.0 秒的小球检测警戒线 (排除刚从顶部释放穿过警戒线的过程)
      if (b.age > 1.0) {
        const topY = b.y - b.radius;
        if (topY <= this.dangerY) {
          anyInDanger = true;
          // 速度低于 25 px/s 视为非弹跳的稳定堆叠
          const speedSq = b.vx * b.vx + b.vy * b.vy;
          if (speedSq < 625) {
            b.dangerTime += dt;
            if (b.dangerTime >= this.dangerDwellTime) {
              if (typeof this.onDangerLineTrigger === 'function') {
                this.onDangerLineTrigger();
                return;
              }
            }
          }
        } else {
          b.dangerTime = Math.max(0, b.dangerTime - dt * 2);
        }
      }
    }

    if (anyInDanger !== this.isWarning) {
      this.isWarning = anyInDanger;
      if (typeof this.onDangerWarning === 'function') {
        this.onDangerWarning(this.isWarning);
      }
    }
  }

  /**
   * 兜底：空间距离接触兜底扫描 (1:1 严格对标斗鱼 Cocos scanProximityMergeCandidates)
   * 严格按照斗鱼 50ms 周期执行，且按舞台比例 8 * (width / 690) 换算容差，严禁隔空吸附
   */
  _scanProximityMerges(dt) {
    this._mergeScanTimer = (this._mergeScanTimer || 0) + dt;
    if (this._mergeScanTimer < 0.05) return;
    this._mergeScanTimer = 0;

    const bodies = this.bodies;
    const count = bodies.length;
    // 斗鱼官方容差: 8px 在 690px 舞台下，等比映射到当前宽度
    const tolerance = 8 * (this.width / 690);

    for (let i = 0; i < count; i++) {
      const b1 = bodies[i];
      if (b1.isMerging || b1.isStatic) continue;

      for (let j = i + 1; j < count; j++) {
        const b2 = bodies[j];
        if (b2.isMerging || b2.isStatic) continue;

        if (b1.level === b2.level && b1.level < MAX_LEVEL) {
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const touchDist = b1.radius + b2.radius + tolerance;
          if (dx * dx + dy * dy <= touchDist * touchDist) {
            this._tryQueueMerge(b1, b2);
          }
        }
      }
    }
  }

  /**
   * 执行合成消除与新球生成 (1:1 严格对标斗鱼 Cocos mergeFruits)
   */
  _resolveMerges(mergePairs) {
    for (const pair of mergePairs) {
      const { b1, b2 } = pair;
      if (!b1 || !b2 || !b1._pBody || !b2._pBody) continue;

      const nextLevel = b1.level + 1;

      // 1:1 斗鱼 pickLowerFruit (Canvas 坐标系 Y 越大代表在屏幕越靠下)
      const lower = (b1.y >= b2.y) ? b1 : b2;
      const newItem = getItemByLevel(nextLevel, this.width);
      const newRadius = newItem ? newItem.radius : lower.radius;

      const spawnX = Math.max(newRadius, Math.min(this.width - newRadius, lower.x));
      const spawnY = Math.min(this.height - newRadius, lower.y);

      // 从物理世界中移除旧刚体
      this.removeBody(b1);
      this.removeBody(b2);

      // 1:1 斗鱼 Cocos mergeFruits：
      // 线速度初值严格设为 (0, 0)
      // 角速度仅继承旧球 20%：0.2 * lower.angularVelocity
      // 旋转角度继承旧球当前姿态：lower.angle
      const newBody = this.createBody(nextLevel, spawnX, spawnY, {
        vx: 0,
        vy: 0,
        angle: lower.angle || 0,
        angularVelocity: (lower.angularVelocity || 0) * 0.2,
        bullet: false // 合成小球原地生成无需开启高速 CCD
      });

      // 1:1 斗鱼 triggerMergeExplosion：施加合成爆炸冲击波
      if (newBody) {
        this.applyRadialExplosion(spawnX, spawnY, newRadius, nextLevel, newBody);
      }

      // 触发外部回调
      if (typeof this.onMerge === 'function') {
        this.onMerge(b1, b2, nextLevel, spawnX, spawnY, newBody);
      }
    }
  }

  /**
   * 1:1 严格对标斗鱼 Cocos triggerMergeExplosion / applyRadialExplosion 径向合成爆炸冲击波
   */
  applyRadialExplosion(cx, cy, radius, level, sourceBody = null) {
    // 斗鱼官方 core: explosionLevelPower(level, 4)
    const power = level <= 4 ? 1 : level - 3;
    // 斗鱼官方: blastRadius = 240 + 42 * e + 0.45 * radius (自适应缩放至当前宽度)
    const stageScale = this.width / 690;
    const blastRadius = (240 + 42 * power + 0.45 * (radius / stageScale)) * stageScale;
    // 斗鱼官方推力系数: o = 3 + 1 * e (非彩票模式纯净对标，严禁额外放大)
    const baseForce = 3.0 + 1.0 * power;

    for (const b of this.bodies) {
      if (b === sourceBody || b.isMerging || b.isStatic || !b._pBody) continue;

      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const y = Math.max(0, dist - 0.45 * b.radius);
      if (y > blastRadius || dist <= 0.001) continue;

      this.wakeBody(b);

      const s = 1 - y / blastRadius;
      // 斗鱼官方二次方非线性衰减: M = o * S * S
      const M = baseForce * s * s;

      const dirX = dx / dist;
      const dirY = dy / dist;

      // 斗鱼官方 1:1 偏置与冲量方程: b = (L * M, (g/p)*M + M * r), r = 0.22 (向上偏置)
      // 在 Canvas 坐标系中，Y 轴向下为正，天空为负方向，因此向上偏置力为 - M * 0.22
      const F = b._pBody.getMass();
      if (F > 0) {
        const impulseX = (dirX * M * F) / SCALE;
        const impulseY = ((dirY * M - M * 0.22) * F) / SCALE;
        b._pBody.applyLinearImpulse(new Vec2(impulseX, impulseY), b._pBody.getWorldCenter(), true);
      }

      // 斗鱼官方受击自转扰动: (L >= 0 ? -1 : 1) * M * 0.035
      const rotDir = dirX >= 0 ? -1 : 1;
      b._pBody.setAngularVelocity(b._pBody.getAngularVelocity() + rotDir * M * 0.035);
    }
  }
}

PhysicsWorldPlanck.preload = ensurePlanck;

module.exports = PhysicsWorldPlanck;
