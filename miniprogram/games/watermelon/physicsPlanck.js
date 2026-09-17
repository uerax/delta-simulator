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

const planckRaw = require('../../lib/planck.min.js');
const planck = (planckRaw && planckRaw.World) ? planckRaw : ((planckRaw && planckRaw.default) ? planckRaw.default : planckRaw);
const { getItemByLevel, MAX_LEVEL } = require('./items');

const Vec2 = planck.Vec2 || (planckRaw && planckRaw.Vec2);

// 像素与米制转换比率：50 像素 = 1 米
const SCALE = 50;

class PhysicsWorldPlanck {
  constructor(options = {}) {
    this.width = options.width || 360;
    this.height = options.height || 600;
    this.gravity = options.gravity !== undefined ? options.gravity : 1300; // px/s^2 严格对标斗鱼 1:1 重力 (1300)
    this.dangerY = options.dangerY !== undefined ? options.dangerY : 70;
    this.dangerDwellTime = options.dangerDwellTime || 0.8;

    this.onMerge = options.onMerge || null;
    this.onDangerLineTrigger = options.onDangerLineTrigger || null;
    this.onDangerWarning = options.onDangerWarning || null;

    this.isWarning = false;
    this.bodies = [];
    this.nextId = 1;
    this._mergePairs = [];
    this._accumulator = 0; // 120Hz 物理步进累加器 (严格对标斗鱼 fixedTimeStep: 1/120)

    // 初始化 Planck.js 物理世界 (重力在屏幕坐标系下 Y 轴向下为正)
    const gravityMeter = this.gravity / SCALE;
    this.world = new planck.World(new Vec2(0, gravityMeter));

    // 创建场地三面静态边界 (底、左、右)
    this._createBoundaries();

    // 监听物理碰撞事件
    this._setupContactListener();
  }

  /**
   * 创建场地三面静态碰撞刚体
   */
  _createBoundaries() {
    const widthMeter = this.width / SCALE;
    const heightMeter = this.height / SCALE;

    this.groundBody = this.world.createBody();

    // 地面
    this.groundBody.createFixture(planck.Edge(new Vec2(0, heightMeter), new Vec2(widthMeter, heightMeter)), {
      friction: 0.2,
      restitution: 0.1
    });

    // 左墙
    this.groundBody.createFixture(planck.Edge(new Vec2(0, 0), new Vec2(0, heightMeter)), {
      friction: 0.2,
      restitution: 0.1
    });

    // 右墙
    this.groundBody.createFixture(planck.Edge(new Vec2(widthMeter, 0), new Vec2(widthMeter, heightMeter)), {
      friction: 0.2,
      restitution: 0.1
    });
  }

  /**
   * 注册碰撞接触监听器
   */
  _setupContactListener() {
    this.world.on('begin-contact', (contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const bA = fA ? fA.getUserData() : null;
      const bB = fB ? fB.getUserData() : null;

      if (!bA || !bB) return;
      if (bA.isMerging || bB.isMerging) return;

      // 1. 偏心接触防发呆机制：若上球落在下球偏斜顶部 (偏心非0)，打破静摩擦死锁引导顺畅滑落
      const upper = (bA.y < bB.y) ? bA : bB;
      const lower = (upper === bA) ? bB : bA;
      const dx = upper.x - lower.x;
      const dy = lower.y - upper.y; // 向上为正

      if (dy > lower.radius * 0.4 && Math.abs(dx) > 0.5 && Math.abs(dx) < (upper.radius + lower.radius) * 0.8) {
        if (upper._pBody && !upper.isStatic && !upper.isMerging) {
          const dir = dx > 0 ? 1 : -1;
          const currentLv = upper._pBody.getLinearVelocity();
          // 若当前水平速度较低，施加轻微水平分离引导速度 (0.4 m/s ~ 20 px/s)
          if (Math.abs(currentLv.x * SCALE) < 25) {
            upper._pBody.setLinearVelocity(new Vec2(dir * 0.45, currentLv.y));
            upper._pBody.setAwake(true);
          }
        }
      }

      // 2. 仅同等级水果且未达最高等级触发合成
      if (bA.level === bB.level && bA.level < MAX_LEVEL) {
        this._tryQueueMerge(bA, bB);
      }
    });
  }

  /**
   * 尝试将碰撞对加入合成队列
   */
  _tryQueueMerge(b1, b2) {
    if (b1.isMerging || b2.isMerging) return;
    const exists = this._mergePairs.some(p => p.b1 === b1 || p.b1 === b2 || p.b2 === b1 || p.b2 === b2);
    if (!exists) {
      this._mergePairs.push({ b1, b2 });
    }
  }

  /**
   * 创建并加入一个物理圆形刚体
   */
  createBody(level, x, y, options = {}) {
    const item = getItemByLevel(level);
    if (!item) return null;

    const radius = item.radius;
    const radiusMeter = radius / SCALE;
    const xMeter = x / SCALE;
    const yMeter = y / SCALE;
    const vxMeter = (options.vx || 0) / SCALE;
    const vyMeter = (options.vy || 0) / SCALE;

    // 创建 Planck 动态刚体 (严格对标斗鱼 Cocos 逆向参数)
    const pBody = this.world.createDynamicBody({
      position: new Vec2(xMeter, yMeter),
      linearVelocity: new Vec2(vxMeter, vyMeter),
      linearDamping: 0.12,   // 1:1 斗鱼 Cocos 线性阻尼
      angularDamping: 0.22,  // 1:1 斗鱼 Cocos 角阻尼
      allowSleep: true,      // 开启休眠，彻底避免微幅自转
      bullet: true           // CCD 防高速下落穿模
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
      angle: 0,
      angularVelocity: 0,
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

    // 2. 将 Planck.js 物理刚体的位置与姿态同步回渲染层 body，并施加地面滚动阻力
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b._pBody || b.isMerging) continue;

      const pos = b._pBody.getPosition();
      const radiusMeter = b.radius / SCALE;

      // 地面滚动阻力 (Rolling Resistance)：消除纯滚动实心球体的无衰减长滑行
      if (pos.y >= heightMeter - radiusMeter - 0.02) {
        const lv = b._pBody.getLinearVelocity();
        const av = b._pBody.getAngularVelocity();
        const rollDecay = Math.max(0, 1 - clampedDt * 1.8);
        b._pBody.setLinearVelocity(new Vec2(lv.x * rollDecay, lv.y));
        b._pBody.setAngularVelocity(av * rollDecay);

        // 低能静止时直接休眠冻结，杜绝地面微幅蠕动
        if (Math.abs(lv.x * SCALE) < 1.0 && Math.abs(av) < 0.08) {
          b._pBody.setLinearVelocity(new Vec2(0, 0));
          b._pBody.setAngularVelocity(0);
          b._pBody.setAwake(false);
        }
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

    // 3. 存活时间与警戒线检测
    this._checkDangerAndAge(clampedDt);

    // 4. 兜底扫描：空间欧式距离辅助判定 (防止两球在极低速度静止接触时接触事件未重发)
    this._scanProximityMerges();

    // 5. 执行合成消除与新球生成
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
   * 兜底：空间欧式距离轮询扫描
   */
  _scanProximityMerges() {
    const bodies = this.bodies;
    const count = bodies.length;

    for (let i = 0; i < count; i++) {
      const b1 = bodies[i];
      if (b1.isMerging || b1.isStatic) continue;

      for (let j = i + 1; j < count; j++) {
        const b2 = bodies[j];
        if (b2.isMerging || b2.isStatic) continue;

        if (b1.level === b2.level && b1.level < MAX_LEVEL) {
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // 允许 6px 贴合容差
          if (dist <= (b1.radius + b2.radius) + 6) {
            this._tryQueueMerge(b1, b2);
          }
        }
      }
    }
  }

  /**
   * 执行合成消除与新球生成
   */
  _resolveMerges(mergePairs) {
    for (const pair of mergePairs) {
      const { b1, b2 } = pair;
      if (b1.isMerging || b2.isMerging) continue;

      b1.isMerging = true;
      b2.isMerging = true;

      const nextLevel = b1.level + 1;

      // 核心手感：pickLowerFruit (Y 越大代表越靠下)
      const lower = (b1.y >= b2.y) ? b1 : b2;
      const newItem = getItemByLevel(nextLevel);
      const newRadius = newItem ? newItem.radius : lower.radius;

      const spawnX = Math.max(newRadius, Math.min(this.width - newRadius, lower.x));
      const spawnY = Math.min(this.height - newRadius, lower.y);

      // 从物理世界中移除旧刚体
      this.removeBody(b1);
      this.removeBody(b2);

      // 创建合成后的新刚体 (继承旧球 20% 速度并微向上跃)
      const newBody = this.createBody(nextLevel, spawnX, spawnY, {
        vx: (b1.vx + b2.vx) * 0.2,
        vy: -30
      });

      // 施加合成冲击波
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
   * 斗鱼 1:1 二次方非线性径向合成爆炸冲击波
   */
  applyRadialExplosion(cx, cy, radius, level, sourceBody = null) {
    const power = level <= 4 ? 1 : level - 3;
    const blastRadius = (240 + 42 * power + 0.45 * radius) * 0.25;
    const baseForce = 2.5; // 极微弱速度冲击，只产生轻微震颤不击飞

    for (const b of this.bodies) {
      if (b === sourceBody || b.isMerging || b.isStatic || !b._pBody) continue;

      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const y = Math.max(0, dist - 0.45 * b.radius);
      if (y > blastRadius || dist <= 0.001) continue;

      this.wakeBody(b);

      const s = 1 - y / blastRadius;
      const M = baseForce * s * s;

      const dirX = dx / dist;
      const dirY = dy / dist;

      // 转换为冲量施加给刚体
      const impulseX = (dirX * M * b.mass) / SCALE;
      const impulseY = (dirY * M * b.mass) / SCALE;

      b._pBody.applyLinearImpulse(new Vec2(impulseX, impulseY), b._pBody.getWorldCenter(), true);
    }
  }
}

module.exports = PhysicsWorldPlanck;
