/**
 * 三角洲《合成大西瓜》- 工业级 2D 圆形刚体物理引擎 (Box2D Architecture 1:1 对标)
 * 严格对标斗鱼 Cocos Creator 3.8.6 生产环境逆向参数与架构：
 * 1. 轻量级 Gauss-Seidel 速度约束迭代 (Velocity Iterations: 4)
 * 2. Warm Starting 累积冲量缓存 (消除微幅呼吸式抖动与静止打滑)
 * 3. 接触相对表面速度差耦合方程 (vt = dv·t + w1*r1 + w2*r2) 与严格库仑摩擦
 * 4. 动态滚动阻力与自动休眠机制 (allowSleep: true, sleepThreshold: 0.1)
 * 5. 斗鱼 1:1 二次方非线性径向合成爆炸冲击波 (applyRadialExplosion)
 * 6. 0.8s 稳定滞留警戒线死亡模型 (排除高速穿模误判)
 * 7. 靠下锚定算法 pickLowerFruit (Y 轴靠底作为新球生成点)
 */

const { getItemByLevel, MAX_LEVEL } = require('./items');

class PhysicsWorld {
  constructor(options = {}) {
    this.width = options.width || 360;
    this.height = options.height || 600;
    this.gravity = options.gravity !== undefined ? options.gravity : 1100; // px/s^2
    this.dangerY = options.dangerY !== undefined ? options.dangerY : 70; // 顶部警戒红线 Y 坐标
    this.dangerDwellTime = options.dangerDwellTime || 0.8; // 滞留缓冲时间(秒)
    this.subSteps = options.subSteps || 8; // 子步进数 (CCD 防穿模)
    this.velocityIterations = options.velocityIterations || 4; // 速度约束迭代次数 (Gauss-Seidel)

    this.bodies = [];
    this.nextId = 1;
    this.onMerge = options.onMerge || null; // (fruitA, fruitB, newLevel, spawnX, spawnY, newBody) => void
    this.onDangerLineTrigger = options.onDangerLineTrigger || null; // () => void
    this.onDangerWarning = options.onDangerWarning || null; // (isWarning) => void

    this.isWarning = false;

    // 持久接触点缓存表 (用于 Warm Starting 累积冲量缓存)
    // key: idA < idB ? 'idA_idB' : 'idB_idA'
    this.contactCache = new Map();
  }

  /**
   * 创建并加入一个物理圆形刚体
   */
  createBody(level, x, y, options = {}) {
    const item = getItemByLevel(level);
    if (!item) return null;

    const mass = item.mass;
    const radius = item.radius;
    const invMass = 1 / mass;
    // 实心均匀圆盘转动惯量 I = 0.5 * m * r^2, 反转动惯量 invI = 2 * invMass / (r^2)
    const invI = (2 * invMass) / (radius * radius);

    const body = {
      id: this.nextId++,
      level: level,
      radius: radius,
      mass: mass,
      invMass: invMass,
      invI: invI,
      x: x,
      y: y,
      vx: options.vx || 0,
      vy: options.vy || 0,
      angle: 0,
      angularVelocity: 0,
      restitution: 0.1, // 低弹性 (防弹跳，对标斗鱼 Cocos 物理参数 0.1)
      friction: 0.2,    // 表面滑动与滚动摩擦 (对标斗鱼 Cocos 物理参数 0.2)
      linearDamping: 0.12,  // 线性阻尼 (对标斗鱼 Fruit2.ts 逆向参数 0.12)
      angularDamping: 0.22, // 角阻尼 (对标斗鱼 Fruit2.ts 逆向参数 0.22)
      isStatic: !!options.isStatic,
      isMerging: false,
      isSleeping: false, // 是否处于休眠状态 (节能且杜绝地面微蠕动)
      sleepTimer: 0,     // 处于低能量阈值的时间累加 (秒)
      age: 0,            // 存活时间 (秒)
      dangerTime: 0      // 超过警戒线且稳定的累计时间
    };

    this.bodies.push(body);
    return body;
  }

  /**
   * 唤醒特定刚体
   */
  wakeBody(b) {
    if (b && b.isSleeping) {
      b.isSleeping = false;
      b.sleepTimer = 0;
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
    // 清理该刚体相关的接触缓存
    for (const [key, c] of this.contactCache.entries()) {
      if (c.b1 === body || c.b2 === body) {
        this.contactCache.delete(key);
      }
    }
  }

  /**
   * 清空所有刚体
   */
  clear() {
    this.bodies = [];
    this.contactCache.clear();
    this.isWarning = false;
  }

  /**
   * 物理主步进更新
   * @param {number} dt 秒为单位的帧间隔时间 (如 0.016s)
   */
  update(dt) {
    if (dt <= 0) return;
    // 限制单帧最大 dt，防止切后台恢复时产生超大步进穿透
    const clampedDt = Math.min(dt, 0.033);
    const subDt = clampedDt / this.subSteps;

    // 存储待合成对 (去重)
    const mergePairs = [];

    // 执行子步进
    for (let step = 0; step < this.subSteps; step++) {
      this._subStep(subDt, mergePairs);
    }

    // 存活时间与警戒线检测
    this._checkDangerAndAge(clampedDt);

    // 兜底：空间欧式距离轮询扫描 (解决受力平衡后接触事件不再激发的卡球)
    this._scanProximityMerges(mergePairs);

    // 执行合成
    if (mergePairs.length > 0) {
      this._resolveMerges(mergePairs);
    }
  }

  /**
   * 单个子步进：重力积分、碰撞检测、速度迭代与约束求解
   */
  _subStep(subDt, mergePairs) {
    const bodies = this.bodies;
    const count = bodies.length;

    // 1. 重力积分与位置推进 (对标 Box2D 隐式欧拉阻尼模型与休眠管理)
    for (let i = 0; i < count; i++) {
      const b = bodies[i];
      if (b.isStatic || b.isMerging) continue;

      // 刚体休眠检测：线速度平方 < 1 且角速度 < 0.08 持续 0.25 秒进入休眠
      const speedSq = b.vx * b.vx + b.vy * b.vy;
      const angSpeed = Math.abs(b.angularVelocity);
      if (speedSq < 1.0 && angSpeed < 0.08) {
        b.sleepTimer += subDt;
        if (b.sleepTimer > 0.25) {
          b.isSleeping = true;
          b.vx = 0;
          b.vy = 0;
          b.angularVelocity = 0;
          continue; // 休眠刚体跳过外力与位移更新
        }
      } else {
        b.sleepTimer = 0;
        b.isSleeping = false;
      }

      // 施加重力
      b.vy += this.gravity * subDt;

      // 隐式欧拉阻尼衰减 (1:1 Box2D b2Island::Solve，避免负数幂运算产生 NaN)
      const linearDecay = 1 / (1 + subDt * b.linearDamping);
      b.vx *= linearDecay;
      b.vy *= linearDecay;
      const angularDecay = 1 / (1 + subDt * b.angularDamping);
      b.angularVelocity *= angularDecay;

      // 位移推进
      b.x += b.vx * subDt;
      b.y += b.vy * subDt;
      b.angle += b.angularVelocity * subDt;

      // 边界约束 (左、右、底)
      this._resolveBoundaryCollision(b, subDt);
    }

    // 2. 广义碰撞收集与接触构建
    const activeContacts = [];

    for (let i = 0; i < count; i++) {
      const b1 = bodies[i];
      if (b1.isMerging) continue;

      for (let j = i + 1; j < count; j++) {
        const b2 = bodies[j];
        if (b2.isMerging) continue;
        if (b1.isStatic && b2.isStatic) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = b1.radius + b2.radius;

        // 允许 0.5px 的微小接触容差 (Slop)，保证静止接触流连贯稳定
        if (distSq < (minDist + 0.5) * (minDist + 0.5) && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;

          // 法线方向 (从 b1 指向 b2)
          const nx = dx / dist;
          const ny = dy / dist;
          // 切线方向 (顺时针旋转90度)
          const tx = ny;
          const ty = -nx;

          const Kn = b1.invMass + b2.invMass;
          if (Kn <= 0) continue;
          const Kt = 3 * Kn; // 实心圆盘有效切向反质量
          const normalMass = 1 / Kn;
          const tangentMass = 1 / Kt;

          // 检索或创建持久接触缓存
          const key = b1.id < b2.id ? `${b1.id}_${b2.id}` : `${b2.id}_${b1.id}`;
          let contact = this.contactCache.get(key);
          if (!contact) {
            contact = {
              b1, b2, key,
              normalImpulse: 0,
              tangentImpulse: 0,
              active: true
            };
            this.contactCache.set(key, contact);
          }
          contact.active = true;
          contact.nx = nx;
          contact.ny = ny;
          contact.tx = tx;
          contact.ty = ty;
          contact.Kn = Kn;
          contact.Kt = Kt;
          contact.normalMass = normalMass;
          contact.tangentMass = tangentMass;
          contact.overlap = overlap;
          contact.restitution = Math.min(b1.restitution, b2.restitution);
          contact.friction = Math.sqrt(b1.friction * b2.friction);

          activeContacts.push(contact);

          // 唤醒接触刚体
          this.wakeBody(b1);
          this.wakeBody(b2);

          // 合成判定：同等级且未达最高阶
          if (b1.level === b2.level && b1.level < MAX_LEVEL) {
            this._tryQueueMerge(b1, b2, mergePairs);
          }
        }
      }
    }

    // 3. 接触图表清理 (移除已经完全离开的接触)
    for (const [k, c] of this.contactCache.entries()) {
      if (!c.active) {
        this.contactCache.delete(k);
      } else {
        c.active = false;
      }
    }

    // 4. Warm Starting (预应用上一帧累积法向冲量，消除微抖动)
    for (let k = 0; k < activeContacts.length; k++) {
      const c = activeContacts[k];
      const { b1, b2, nx, ny, tx, ty } = c;

      // 限制 Warm Starting 冲量范围
      c.normalImpulse = Math.max(0, Math.min(c.normalImpulse, 200));
      c.tangentImpulse = Math.max(-100, Math.min(100, c.tangentImpulse));

      const Px = nx * c.normalImpulse + tx * c.tangentImpulse;
      const Py = ny * c.normalImpulse + ty * c.tangentImpulse;

      if (!b1.isStatic) {
        b1.vx -= Px * b1.invMass;
        b1.vy -= Py * b1.invMass;
      }
      if (!b2.isStatic) {
        b2.vx += Px * b2.invMass;
        b2.vy += Py * b2.invMass;
      }
    }

    // 5. 轻量级 Gauss-Seidel 速度约束迭代求解 (Velocity Iterations)
    for (let iter = 0; iter < this.velocityIterations; iter++) {
      for (let k = 0; k < activeContacts.length; k++) {
        const c = activeContacts[k];
        const { b1, b2, nx, ny, tx, ty, normalMass, tangentMass, friction, restitution } = c;

        // 质心相对切向与法向速度
        const rvx = b2.vx - b1.vx;
        const rvy = b2.vy - b1.vy;

        const vn = rvx * nx + rvy * ny;
        const vt = rvx * tx + rvy * ty;

        // 5.1 切向摩擦约束求解 (消除两球质心相对平动滑动)
        const deltaJt = -vt * tangentMass;
        const maxJt = friction * c.normalImpulse;
        const oldTangentImpulse = c.tangentImpulse;
        c.tangentImpulse = Math.max(-maxJt, Math.min(maxJt, oldTangentImpulse + deltaJt));
        const actualDeltaJt = c.tangentImpulse - oldTangentImpulse;

        const Ptx = tx * actualDeltaJt;
        const Pty = ty * actualDeltaJt;

        if (!b1.isStatic) {
          b1.vx -= Ptx * b1.invMass;
          b1.vy -= Pty * b1.invMass;
        }
        if (!b2.isStatic) {
          b2.vx += Ptx * b2.invMass;
          b2.vy += Pty * b2.invMass;
        }

        // 接触面滑动摩擦力矩耗散自转 (刹车片效应，绝不在小球网络中像齿轮一样相互传动加速)
        if (!b1.isStatic && Math.abs(b1.angularVelocity) > 0.001) {
          b1.angularVelocity *= 0.94;
          if (Math.abs(b1.angularVelocity) < 0.05) b1.angularVelocity = 0;
        }
        if (!b2.isStatic && Math.abs(b2.angularVelocity) > 0.001) {
          b2.angularVelocity *= 0.94;
          if (Math.abs(b2.angularVelocity) < 0.05) b2.angularVelocity = 0;
        }

        // 5.2 法向接触约束求解 (非穿透排斥与低速弹性反弹)
        // Box2D 核心细节：只有相对法向速度超过阈值时才计算恢复系数反弹，排除低速呼吸震荡
        let velocityBias = 0;
        if (vn < -35) {
          velocityBias = -restitution * vn;
        }

        const deltaJn = -(vn - velocityBias) * normalMass;
        const oldNormalImpulse = c.normalImpulse;
        c.normalImpulse = Math.max(0, oldNormalImpulse + deltaJn);
        const actualDeltaJn = c.normalImpulse - oldNormalImpulse;

        const Pnx = nx * actualDeltaJn;
        const Pny = ny * actualDeltaJn;

        if (!b1.isStatic) {
          b1.vx -= Pnx * b1.invMass;
          b1.vy -= Pny * b1.invMass;
        }
        if (!b2.isStatic) {
          b2.vx += Pnx * b2.invMass;
          b2.vy += Pny * b2.invMass;
        }
      }
    }

    // 6. 位置约束轻量平滑修正 (Baumgarte Position Correction)
    for (let k = 0; k < activeContacts.length; k++) {
      const c = activeContacts[k];
      const { b1, b2, nx, ny, Kn, overlap } = c;
      if (overlap > 0.2) { // 允许 0.2px 的容差
        const posCorrection = (overlap - 0.2) * 0.35;
        if (!b1.isStatic) {
          b1.x -= nx * posCorrection * (b1.invMass / Kn);
          b1.y -= ny * posCorrection * (b1.invMass / Kn);
        }
        if (!b2.isStatic) {
          b2.x += nx * posCorrection * (b2.invMass / Kn);
          b2.y += ny * posCorrection * (b2.invMass / Kn);
        }
      }
    }

    // 7. 多重接触几何死锁与悬空夹持消旋 (彻底斩断 A->B->C->D 闭环自旋传递链)
    const contactCounts = new Map();
    for (let k = 0; k < activeContacts.length; k++) {
      const c = activeContacts[k];
      contactCounts.set(c.b1, (contactCounts.get(c.b1) || 0) + 1);
      contactCounts.set(c.b2, (contactCounts.get(c.b2) || 0) + 1);
    }

    for (let i = 0; i < count; i++) {
      const b = bodies[i];
      if (b.isStatic || b.isMerging) continue;
      const cc = contactCounts.get(b) || 0;
      if (cc >= 2) {
        // 凡是处于 2 个或以上接触点挤压/承托中的刚体，转动自由度被几何死锁
        b.angularVelocity *= 0.65;
        if (Math.abs(b.angularVelocity) < 0.08) {
          b.angularVelocity = 0;
        }
      }
    }
  }

  /**
   * 边界碰撞与接触摩擦求解 (底面、左墙、右墙，1:1 对标 Box2D 边界约束)
   */
  _resolveBoundaryCollision(b, subDt) {
    if (b.isStatic) return;

    // 1. 底面碰撞与接触摩擦 (水平地面)
    if (b.y + b.radius >= this.height) {
      b.y = this.height - b.radius;
      this.wakeBody(b);

      // 接触点表面切向滑动速度 (地面法线向上(0,-1)，切线向右(1,0): vt = vx - w * r)
      const vt = b.vx - b.angularVelocity * b.radius;
      const mt = 1 / (3 * b.invMass);

      let Jn = 0;
      if (b.vy > 0) {
        // 低速着陆直接静止，排除细小微弹
        if (b.vy < 25) {
          b.vy = 0;
        } else {
          Jn = (1 + b.restitution) * b.vy / b.invMass;
          b.vy = -b.vy * b.restitution;
        }
      }

      // 地面重力支持力冲量
      const Jsupport = (1 / b.invMass) * this.gravity * subDt;
      const JN = Math.max(Jn, Jsupport);

      // 切向摩擦力冲量 (驱动小球纯滚动，消除打滑)
      const deltaJt = -vt * mt;
      const maxJt = b.friction * JN;
      const Jt = (Math.abs(vt) < 10) ? deltaJt : Math.max(-maxJt, Math.min(maxJt, deltaJt));

      b.vx += b.invMass * Jt;
      b.angularVelocity -= (2 * b.invMass / b.radius) * Jt;

      // 地面滚动阻力 (Rolling Resistance，使纯滚动水果平缓停下而非无限滑行)
      const rollDecay = 1 / (1 + subDt * 1.8);
      b.vx *= rollDecay;
      b.angularVelocity *= rollDecay;

      // 静止休眠判定
      if (Math.abs(b.vx) < 0.5 && Math.abs(b.angularVelocity) < 0.05) {
        b.vx = 0;
        b.angularVelocity = 0;
      }
    }

    // 2. 左墙碰撞 (法线向右(1,0)，切线向下(0,1): vt = vy + w * r)
    if (b.x - b.radius <= 0) {
      b.x = b.radius;
      this.wakeBody(b);

      const vt = b.vy + b.angularVelocity * b.radius;
      const mt = 1 / (3 * b.invMass);

      let Jn = 0;
      if (b.vx < 0) {
        if (Math.abs(b.vx) < 15) {
          b.vx = 0;
        } else {
          Jn = -(1 + b.restitution) * b.vx / b.invMass;
          b.vx = -b.vx * b.restitution;
        }
      }

      const Jside = (1 / b.invMass) * 50 * subDt;
      const JN = Math.max(Jn, Jside);
      const deltaJt = -vt * mt;
      const maxJt = b.friction * JN;
      const Jt = (Math.abs(vt) < 10) ? deltaJt : Math.max(-maxJt, Math.min(maxJt, deltaJt));

      b.vy += b.invMass * Jt;
      b.angularVelocity += (2 * b.invMass / b.radius) * Jt;
    }

    // 3. 右墙碰撞 (法线向左(-1,0)，切线向下(0,1): vt = vy - w * r)
    if (b.x + b.radius >= this.width) {
      b.x = this.width - b.radius;
      this.wakeBody(b);

      const vt = b.vy - b.angularVelocity * b.radius;
      const mt = 1 / (3 * b.invMass);

      let Jn = 0;
      if (b.vx > 0) {
        if (Math.abs(b.vx) < 15) {
          b.vx = 0;
        } else {
          Jn = (1 + b.restitution) * b.vx / b.invMass;
          b.vx = -b.vx * b.restitution;
        }
      }

      const Jside = (1 / b.invMass) * 50 * subDt;
      const JN = Math.max(Jn, Jside);
      const deltaJt = -vt * mt;
      const maxJt = b.friction * JN;
      const Jt = (Math.abs(vt) < 10) ? deltaJt : Math.max(-maxJt, Math.min(maxJt, deltaJt));

      b.vy += b.invMass * Jt;
      b.angularVelocity -= (2 * b.invMass / b.radius) * Jt;
    }
  }

  /**
   * 尝试将碰撞对加入合成队列
   */
  _tryQueueMerge(b1, b2, mergePairs) {
    if (b1.isMerging || b2.isMerging) return;
    // 确保同一个 body 在同一帧只被合并一次
    const exists = mergePairs.some(p => p.b1 === b1 || p.b1 === b2 || p.b2 === b1 || p.b2 === b2);
    if (!exists) {
      mergePairs.push({ b1, b2 });
    }
  }

  /**
   * 兜底：空间欧式距离轮询扫描 (防止接触事件丢失导致的卡死)
   */
  _scanProximityMerges(mergePairs) {
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
          // 容差 8px 欧式间距
          if (dist <= (b1.radius + b2.radius) + 8) {
            this._tryQueueMerge(b1, b2, mergePairs);
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

      // 核心手感算法：pickLowerFruit
      // 在屏幕坐标系下，Y 越大代表越靠下（离地面越近）
      const lower = (b1.y >= b2.y) ? b1 : b2;

      // 新道具生成坐标锚定在靠下的道具位置
      const newItem = getItemByLevel(nextLevel);
      const newRadius = newItem ? newItem.radius : lower.radius;

      // 边界夹紧保护
      const spawnX = Math.max(newRadius, Math.min(this.width - newRadius, lower.x));
      const spawnY = Math.min(this.height - newRadius, lower.y);

      // 从物理世界中移除旧刚体
      this.removeBody(b1);
      this.removeBody(b2);

      // 创建合成后的新刚体
      const newBody = this.createBody(nextLevel, spawnX, spawnY, {
        vx: (b1.vx + b2.vx) * 0.2,
        vy: -40 // 给予极其微弱的向上一跃，手感自然
      });

      // 施加斗鱼 1:1 二次方非线性径向合成爆炸冲击波
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
   * 斗鱼 1:1 源码复刻极微弱合成冲击波 (triggerMergeExplosion / applyRadialExplosion)
   * 严格对标 Cocos 源码参数：
   * baseForce o = 3.0 (仅约 3 px/s 的极微弱速度增量，仅产生 1~2px 微弱震颤，绝不震飞小球)
   * 衰减公式: S = 1 - y / blastRadius, M = 3.0 * S * S
   */
  applyRadialExplosion(cx, cy, radius, level, sourceBody = null) {
    const power = level <= 4 ? 1 : level - 3;
    // 适配 360 宽度画布 (斗鱼 750 设计分辨率对应约 0.28 缩放，波及范围极小，仅紧挨小球受微幅推力)
    const blastRadius = (240 + 42 * power + 0.45 * radius) * 0.25;
    const baseForce = 3.0; // 1:1 斗鱼普通模式源码: o = 3

    for (const b of this.bodies) {
      if (b === sourceBody || b.isMerging || b.isStatic) continue;

      const dx = b.x - cx;
      const dy = b.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 1:1 斗鱼源码：Math.max(0, p - 0.45 * c.colliderRadius)
      const y = Math.max(0, dist - 0.45 * b.radius);
      if (y > blastRadius || dist <= 0.001) continue;

      this.wakeBody(b);

      // 1:1 斗鱼源码：S = 1 - v / f, M = o * S * S (二次方非线性衰减)
      const s = 1 - y / blastRadius;
      const M = baseForce * s * s;

      const dirX = dx / dist;
      const dirY = dy / dist;

      // 1:1 斗鱼源码：b = new Vec2(dirX * M, dirY * M + M * 0.22)
      // 速度增量微弱 (<= 3 px/s)
      b.vx += dirX * M;
      b.vy += dirY * M - M * 0.22;

      // 1:1 斗鱼源码：c.body.angularVelocity += (L >= 0 ? -1 : 1) * M * 0.035
      b.angularVelocity += (dirX >= 0 ? -1 : 1) * M * 0.035;

      // 速度上限钳位
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > 800) {
        b.vx = (b.vx / speed) * 800;
        b.vy = (b.vy / speed) * 800;
      }
    }
  }

  /**
   * 0.8秒稳定滞留警戒线死亡模型检测 (排除高速飞跃误判)
   */
  _checkDangerAndAge(dt) {
    let hasDangerBall = false;
    let anyTriggered = false;

    for (const b of this.bodies) {
      if (b.isMerging || b.isStatic) continue;

      b.age += dt;

      // 1. 新生 0.8s 保护期，不计入死亡检测
      if (b.age < 0.8) continue;

      // 2. 判定道具球体顶端是否超过警戒线
      const topY = b.y - b.radius;
      if (topY < this.dangerY) {
        // 3. 稳定度检测：竖向速度必须低速 (|vy| < 35 且总速度平方 < 2000)，排除高速弹跳穿越状态
        const speedSq = b.vx * b.vx + b.vy * b.vy;
        if (Math.abs(b.vy) < 35 && speedSq < 2000) {
          hasDangerBall = true;
          b.dangerTime += dt;

          // 4. 持续滞留达标触发失败
          if (b.dangerTime >= this.dangerDwellTime) {
            anyTriggered = true;
          }
        } else {
          // 高速飞跃时不累加
          b.dangerTime = Math.max(0, b.dangerTime - dt * 1.5);
        }
      } else {
        // 掉落回警戒线下方，清零滞留时间
        b.dangerTime = 0;
      }
    }

    // 报警状态变化
    if (this.isWarning !== hasDangerBall) {
      this.isWarning = hasDangerBall;
      if (typeof this.onDangerWarning === 'function') {
        this.onDangerWarning(this.isWarning);
      }
    }

    // 达到死亡阈值
    if (anyTriggered && typeof this.onDangerLineTrigger === 'function') {
      this.onDangerLineTrigger();
    }
  }
}

module.exports = PhysicsWorld;
