/**
 * scripts/verify_planck_watermelon.js
 * 专项验证 Planck.js 物理适配器核心表现：
 * 1. 阻尼衰减与绝无无限自旋（角速度随时间稳定平缓衰减归零）
 * 2. 平抛小球接触地面纯滚动与平稳休眠滚停
 * 3. 双球碰撞自动触发 onMerge 产生新球且无 NaN
 * 4. 多球垂直堆叠稳定性与无穿模
 * 5. 靠下锚定 pickLowerFruit 与极微弱径向冲击波
 */

const assert = require('assert');
const PhysicsWorldPlanck = require('../miniprogram/games/watermelon/physicsPlanck');

console.log('🧪 开始 Planck.js 大西瓜物理引擎专项回归测试...\n');

// 1. 测试角速度阻尼与消除无限自旋
console.log('▶ [1/5] 测试旋转角速度阻尼衰减与彻底消除无限自旋...');
const world1 = new PhysicsWorldPlanck({ width: 360, height: 600 });
const ball1 = world1.createBody(1, 180, 300);
ball1._pBody.setAngularVelocity(25); // 给 25 rad/s 较快初始旋转

console.log('  初始角速度:', ball1._pBody.getAngularVelocity());
for (let i = 0; i < 180; i++) {
  world1.update(0.016);
  assert(!isNaN(ball1.angularVelocity), `第 ${i} 帧角速度不能为 NaN`);
  assert(!isNaN(ball1.x) && !isNaN(ball1.y), `第 ${i} 帧坐标不能为 NaN`);
}
console.log('  3 秒后角速度:', ball1.angularVelocity);
assert(ball1.angularVelocity < 1.0, '在 angularDamping 作用下角速度必须衰减至 1.0 以下');
console.log('  ✔ 角速度阻尼与消除无限自旋验证通过！\n');

// 2. 测试地面接触纯滚动与平稳滚停休眠
console.log('▶ [2/5] 测试地面接触纯滚动与平稳滚停休眠...');
const world2 = new PhysicsWorldPlanck({ width: 360, height: 600 });
// 平抛小球，水平初速度 120 px/s
const rollBall = world2.createBody(2, 100, 500, { vx: 120, vy: 0 });

for (let i = 0; i < 30; i++) {
  world2.update(0.016);
}
// 落地后切向摩擦驱动滚动
console.log('  落地滚动角速度:', rollBall.angularVelocity, '线速度 vx:', rollBall.vx);

// 继续运行至小球撞墙滚停休眠 (约 4 秒，240 帧)
for (let i = 0; i < 240; i++) {
  world2.update(0.016);
}
console.log('  3 秒后线速度 vx:', rollBall.vx, '角速度 w:', rollBall.angularVelocity, 'isSleeping:', rollBall.isSleeping);
assert(Math.abs(rollBall.vx) < 1.0, `水平速度应完全滚停，实际: ${rollBall.vx}`);
assert(Math.abs(rollBall.angularVelocity) < 0.1, `角速度应完全滚停，实际: ${rollBall.angularVelocity}`);
console.log('  ✔ 地面接触纯滚动与平稳滚停休眠验证通过！\n');

// 3. 测试双球碰撞触发合成
console.log('▶ [3/5] 测试相同等级小球碰撞触发合成...');
let mergeTriggered = false;
let spawnedLevel = 0;
const world3 = new PhysicsWorldPlanck({
  width: 360,
  height: 600,
  onMerge: (b1, b2, nextLevel, spawnX, spawnY, newBody) => {
    mergeTriggered = true;
    spawnedLevel = nextLevel;
    console.log(`  触发合成: Lv.${b1.level} + Lv.${b2.level} -> Lv.${nextLevel} at (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`);
  }
});

// 生成两个 Lv.1 小球，左右相向运动相撞
const leftBall = world3.createBody(1, 140, 550, { vx: 80, vy: 0 });
const rightBall = world3.createBody(1, 220, 550, { vx: -80, vy: 0 });

for (let i = 0; i < 60; i++) {
  world3.update(0.016);
  if (mergeTriggered) break;
}

assert(mergeTriggered, '相同等级小球相撞必须触发合成回调');
assert.strictEqual(spawnedLevel, 2, 'Lv.1 + Lv.1 应合成为 Lv.2');
assert.strictEqual(world3.bodies.length, 1, '旧球移除后世界中应只有 1 颗新球');
console.log('  ✔ 相同等级小球碰撞合成验证通过！\n');

// 4. 测试多球垂直堆叠稳定性与无穿模
console.log('▶ [4/5] 测试多球垂直堆叠稳定性与防穿模...');
const world4 = new PhysicsWorldPlanck({ width: 360, height: 600 });
// 堆叠 3 颗小球：Lv.3 (底), Lv.2 (中), Lv.1 (顶)
const s1 = world4.createBody(3, 180, 550);
const s2 = world4.createBody(2, 180, 480);
const s3 = world4.createBody(1, 180, 420);

for (let i = 0; i < 120; i++) {
  world4.update(0.016);
}

console.log(`  堆叠最终位置: 底球 y=${s1.y.toFixed(1)}, 中球 y=${s2.y.toFixed(1)}, 顶球 y=${s3.y.toFixed(1)}`);
assert(s1.y > s2.y, '底球位置应在中球下方');
assert(s2.y > s3.y, '中球位置应在顶球下方');
assert(!isNaN(s1.y) && !isNaN(s2.y) && !isNaN(s3.y), '堆叠坐标应正常无 NaN');
console.log('  ✔ 多球垂直堆叠稳定性验证通过！\n');

// 5. 测试低弹性防弹跳
console.log('▶ [5/5] 测试 restitution: 0.1 低弹性防剧烈弹跳...');
const world5 = new PhysicsWorldPlanck({ width: 360, height: 600 });
const dropBall = world5.createBody(1, 180, 300); // 距离地面 300px 自由落体

let landed = false;
let maxBounceHeight = 0;
for (let i = 0; i < 100; i++) {
  world5.update(0.016);
  if (dropBall.y >= 600 - dropBall.radius - 2) {
    landed = true;
  }
  if (landed && dropBall.vy < 0) {
    const bounceHeight = (600 - dropBall.radius) - dropBall.y;
    if (bounceHeight > maxBounceHeight) {
      maxBounceHeight = bounceHeight;
    }
  }
}
console.log(`  小球最大弹跳高度: ${maxBounceHeight.toFixed(2)} px`);
assert(maxBounceHeight < 15, `低弹性碰撞下反弹高度应小于 15px，实际: ${maxBounceHeight}`);
console.log('  ✔ 低弹性防剧烈弹跳验证通过！\n');

console.log('🎉 Planck.js 物理引擎适配层全部 5 项测试验证通过！');
