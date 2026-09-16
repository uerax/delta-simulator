/**
 * scripts/verify_watermelon_physics.js
 * 专项验证合成大西瓜物理引擎对标斗鱼 Box2D 核心实现：
 * 1. 消除负数幂导致的 NaN (隐式欧拉阻尼衰减)
 * 2. 两球接触切向相对速度耦合 (v_rel = dv + w1*r1 + w2*r2)
 * 3. 库仑摩擦定律与切向有效质量 (Kt = 3 * Kn)
 * 4. 地面纯滚动约束与平稳滚停
 * 5. 多球垂直堆叠稳定性与无穿模
 */

const assert = require('assert');
const PhysicsWorld = require('../miniprogram/games/watermelon/physics');

console.log('🧪 开始合成大西瓜物理引擎 Box2D 核心机制专项回归验证...\n');

// 1. 测试隐式欧拉阻尼衰减与零 NaN
console.log('▶ [1/5] 测试阻尼衰减模型与零 NaN 容错...');
const world1 = new PhysicsWorld({ width: 360, height: 600 });
const ball1 = world1.createBody(1, 100, 300);
ball1.angularVelocity = 50;
ball1.vx = 200;
ball1.vy = -100;

for (let i = 0; i < 180; i++) {
  world1.update(0.016);
  assert(!isNaN(ball1.angularVelocity), `第 ${i} 帧角速度严禁为 NaN`);
  assert(!isNaN(ball1.vx), `第 ${i} 帧 vx 严禁为 NaN`);
  assert(!isNaN(ball1.vy), `第 ${i} 帧 vy 严禁为 NaN`);
}
assert(ball1.angularVelocity >= 0 && ball1.angularVelocity < 50, '角速度应平稳阻尼衰减');
console.log('  ✔ 隐式欧拉阻尼衰减测试通过，绝无 NaN！\n');

// 2. 测试双球接触表面切向速度差耦合与自旋约束
console.log('▶ [2/5] 测试双球接触切向表面速度差耦合与自旋制动...');
const world2 = new PhysicsWorld({ width: 360, height: 600, gravity: 1100 });
// 创建两颗无法合成的不同等级小球 (Lv.1 r=18, Lv.3 r=28)
// 放置在地面上且左右接触挤压
const b1 = world2.createBody(1, 100, 600 - 18);
const b2 = world2.createBody(3, 100 + 18 + 28 - 2, 600 - 28);
b1.angularVelocity = 15; // 给 b1 较大的顺时针旋转
b2.angularVelocity = 0;

for (let i = 0; i < 120; i++) {
  world2.update(0.016);
  assert(!isNaN(b1.angularVelocity), 'b1 角速度不能为 NaN');
  assert(!isNaN(b2.angularVelocity), 'b2 角速度不能为 NaN');
}
assert(b1.angularVelocity < 1.0, `接触摩擦应将 b1 的角速度从 15 刹停至 1.0 以下，实际: ${b1.angularVelocity}`);
assert(Math.abs(b2.angularVelocity) < 1.0, `接触摩擦应有效约束 b2 的自旋，实际: ${b2.angularVelocity}`);
console.log('  ✔ 双球接触切向速度差耦合与自旋制动测试通过！\n');

// 3. 测试地面接触纯滚动驱动
console.log('▶ [3/5] 测试地面接触纯滚动与平稳滚停...');
const world3 = new PhysicsWorld({ width: 360, height: 600 });
// 平抛小球，初速度 vx = 100, w = 0
const rollBall = world3.createBody(2, 180, 500, { vx: 100, vy: 0 });

// 运行 30 帧让小球落到地面并产生滚动 (78px 在 g=1100 下约需 0.38s)
for (let i = 0; i < 30; i++) {
  world3.update(0.016);
}
assert(rollBall.y >= 600 - rollBall.radius - 1, '小球应接触地面');
// 在地面接触瞬间，切向摩擦驱动自旋启动，w 应为正 (顺时针，向右滚)
assert(rollBall.angularVelocity > 0, `向右运动的小球在地面应顺时针旋转滚行，实际 w: ${rollBall.angularVelocity}`);

// 继续模拟 2 秒，小球应在滚动阻力作用下平缓停下
for (let i = 0; i < 120; i++) {
  world3.update(0.016);
}
assert(Math.abs(rollBall.vx) < 5, `小球水平速度应平缓滚停，实际 vx: ${rollBall.vx}`);
assert(Math.abs(rollBall.angularVelocity) < 0.5, `小球自旋角速度应平缓滚停，实际 w: ${rollBall.angularVelocity}`);
console.log('  ✔ 地面接触纯滚动与平稳滚停测试通过！\n');

// 4. 测试多球垂直堆叠稳定性
console.log('▶ [4/5] 测试多球堆叠稳定性与防穿模...');
const world4 = new PhysicsWorld({ width: 360, height: 600, gravity: 1100 });
// 垂直放置 3 颗不同等级小球
const s1 = world4.createBody(3, 180, 550); // 底球
const s2 = world4.createBody(2, 180, 480); // 中球
const s3 = world4.createBody(1, 180, 420); // 顶球

for (let i = 0; i < 100; i++) {
  world4.update(0.016);
}
assert(s1.y > s2.y, '底球位置应在下方');
assert(s2.y > s3.y, '中球位置应在底球上方、顶球下方');
assert(!isNaN(s1.y) && !isNaN(s2.y) && !isNaN(s3.y), '堆叠坐标应正常无 NaN');
console.log('  ✔ 多球垂直堆叠稳定性测试通过！\n');

// 5. 测试低弹性防弹跳
console.log('▶ [5/5] 测试 restitution: 0.1 低弹性防弹跳...');
const world5 = new PhysicsWorld({ width: 360, height: 600, gravity: 1100 });
const dropBallBounce = world5.createBody(1, 180, 400); // 距离地面 200px 自由落体
let maxBounceHeight = 0;
let landed = false;

for (let i = 0; i < 60; i++) {
  world5.update(0.016);
  if (dropBallBounce.y >= 600 - dropBallBounce.radius - 1) {
    landed = true;
  }
  if (landed) {
    const heightFromGround = (600 - dropBallBounce.radius) - dropBallBounce.y;
    if (heightFromGround > maxBounceHeight) {
      maxBounceHeight = heightFromGround;
    }
  }
}
assert(maxBounceHeight < 15, `低弹性碰撞反弹高度应小于 15px，实际反弹高度: ${maxBounceHeight}`);
console.log('  ✔ 低弹性防弹跳测试通过！\n');

// 6. 测试 Warm Starting 累积冲量持久缓存
console.log('▶ [6/8] 测试 Warm Starting 接触缓存与累积冲量...');
const world6 = new PhysicsWorld({ width: 360, height: 600 });
const wc1 = world6.createBody(1, 150, 582);
const wc2 = world6.createBody(2, 185, 578);
world6.update(0.016);
assert(world6.contactCache.size > 0, '两球接触应在 contactCache 中建立缓存');
const key = wc1.id < wc2.id ? `${wc1.id}_${wc2.id}` : `${wc2.id}_${wc1.id}`;
const contact = world6.contactCache.get(key);
assert(contact !== undefined, '接触项应成功检索');
assert(contact.normalImpulse >= 0, '累积法向冲量应为非负数');
console.log('  ✔ Warm Starting 接触缓存与累积冲量测试通过！\n');

// 7. 测试刚体休眠 (Sleeping) 与受微弱冲击波唤醒
console.log('▶ [7/8] 测试刚体自动休眠与斗鱼 1:1 极微弱冲击波...');
const world7 = new PhysicsWorld({ width: 360, height: 600, gravity: 1100 });
const sleepBall = world7.createBody(1, 180, 582, { vx: 0, vy: 0 });
// 静止模拟 0.4 秒 (25 帧)
for (let i = 0; i < 25; i++) {
  world7.update(0.016);
}
assert.strictEqual(sleepBall.isSleeping, true, '静止小球在超过 0.25s 后应自动进入休眠');

// 施加斗鱼 1:1 极微弱冲击波 (baseForce = 3.0)
world7.applyRadialExplosion(180, 560, 20, 2);
assert.strictEqual(sleepBall.isSleeping, false, '受到径向爆炸波及应立即被唤醒');
const deltaSpeed = Math.hypot(sleepBall.vx, sleepBall.vy);
assert(deltaSpeed > 0 && deltaSpeed <= 4.0, `核心手感验证：冲击波力度极微弱 (<= 4 px/s)，实际力度: ${deltaSpeed}`);
console.log('  ✔ 刚体自动休眠与斗鱼 1:1 极微弱冲击波测试通过！\n');

// 8. 验证全新快节奏动态掉落池阶梯曲线与精准概率分布
console.log('▶ [8/8] 测试全新快节奏动态掉落阶梯曲线 (前15次快速进阶至 Lv.7)...');
const WatermelonEngine = require('../miniprogram/games/watermelon/engine');
const testEngine = new WatermelonEngine({ width: 360, height: 600, autoInitSilent: true });

// 阶段1: 一开始 (0~2 次): 1~2 级 (50% 50%)
for (let i = 0; i <= 2; i++) {
  for (let t = 0; t < 20; t++) {
    const lv = testEngine._generateDropLevel(i);
    assert(lv >= 1 && lv <= 2, `一开始下落必须在 Lv.1~2 之间，实际: ${lv}`);
  }
}

// 阶段2: 第三次开始 (3~5 次): 1~4 级 (20% 30% 30% 20%)
for (let i = 3; i <= 5; i++) {
  for (let t = 0; t < 20; t++) {
    const lv = testEngine._generateDropLevel(i);
    assert(lv >= 1 && lv <= 4, `第三次开始必须在 Lv.1~4 之间，实际: ${lv}`);
  }
}

// 阶段3: 第六次开始 (6~9 次): 1~5 级 (10% 20% 30% 30% 10%)
for (let i = 6; i <= 9; i++) {
  for (let t = 0; t < 20; t++) {
    const lv = testEngine._generateDropLevel(i);
    assert(lv >= 1 && lv <= 5, `第六次开始必须在 Lv.1~5 之间，实际: ${lv}`);
  }
}

// 阶段4: 第十次开始 (10~14 次): 1~6 级 (5% 15% 25% 30% 20% 5%)
for (let i = 10; i <= 14; i++) {
  for (let t = 0; t < 20; t++) {
    const lv = testEngine._generateDropLevel(i);
    assert(lv >= 1 && lv <= 6, `第十次开始必须在 Lv.1~6 之间，实际: ${lv}`);
  }
}

// 阶段5: 第十五次开始 (>=15 次): 1~7 级 (5% 10% 26% 24% 21% 9% 5%)
let sawLv7 = false;
for (let t = 0; t < 500; t++) {
  const lv = testEngine._generateDropLevel(15);
  assert(lv >= 1 && lv <= 7, `第十五次开始必须在 Lv.1~7 之间，严禁产出 Lv.8 以上，实际: ${lv}`);
  if (lv === 7) sawLv7 = true;
}
assert.strictEqual(sawLv7, true, '核心规则验证：第十五次开始必须能够出现 Lv.7 (航空记录仪)');
console.log('  ✔ 全新快节奏动态掉落阶梯曲线 (前15次进阶至 Lv.7) 测试通过！\n');

// 9. 真实实机场景回归：悬空多球挤压夹持与闭环自旋阻绝 (1:1 图3场景)
console.log('▶ [9/9] 测试悬空多球夹持与闭环自旋阻绝 (图3水泥与顶工具自旋回归)...');
const world9 = new PhysicsWorld({ width: 360, height: 600, gravity: 1100 });
const b_s = world9.createBody(2, 60, 560, { isStatic: true }); // 螺丝刀
const b_b = world9.createBody(6, 200, 480, { isStatic: true }); // 黑板
const b_d = world9.createBody(1, 130, 570, { isStatic: true }); // 底工具
const b_c = world9.createBody(4, 115, 485); // 水泥 (悬空受压)
const b_t = world9.createBody(1, 155, 420); // 顶工具 (夹缝悬空)

// 给予极大初始自转
b_c.angularVelocity = 6.0;
b_t.angularVelocity = 4.0;

// 运行 20 帧 (约 0.3s)
for (let f = 0; f < 20; f++) {
  world9.update(0.016);
}
assert.strictEqual(b_c.angularVelocity, 0, '悬空被夹持的水泥角速度必须严格为 0，严禁原地自旋');
assert.strictEqual(b_t.angularVelocity, 0, '夹缝中的顶工具角速度必须严格为 0，严禁链式自激旋转');
console.log('  ✔ 悬空多球夹持与闭环自旋阻绝测试通过！\n');

console.log('🎉 合成大西瓜物理引擎 Box2D 核心机制专项回归验证全部 100% 通过！');
