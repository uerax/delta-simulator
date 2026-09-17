/**
 * scripts/verify_watermelon_merge_behavior.js
 * 专项验证大西瓜合成防吸附与不同等级质量重力手感：
 * 1. 验证新水果合成时赋予 0.18s 出生保护期，防止瞬时膨胀与邻近同级水果发生瞬间重叠吸附连续合成
 * 2. 验证 1:1 对标斗鱼 Cocos triggerMergeExplosion 径向爆炸冲击波推散周围邻近水果，拉开物理间距
 * 3. 验证 0.12 线性阻尼下自由落体的真实重力加速度与势能感 (对比旧版 1.1 阻尼)
 * 4. 验证真实质量阶梯分布 (大金质量为小牙膏 44.4 倍)，大球卡紧稳如泰山、小球轻盈易推
 */

const assert = require('assert');
const PhysicsWorldPlanck = require('../miniprogram/games/watermelon/physicsPlanck');
const { getItemByLevel } = require('../miniprogram/games/watermelon/items');

console.log('🧪 开始大西瓜合成防吸附与真实质量重力手感专项验证...\n');

// 1. 验证合成防吸附与出生保护期
console.log('▶ [1/4] 测试合成防吸附与出生保护期 (防止相邻同级水果被自动吸附)...');
let mergeCount = 0;
const mergedLevels = [];
const world1 = new PhysicsWorldPlanck({
  width: 360,
  height: 600,
  onMerge: (b1, b2, nextLevel) => {
    mergeCount++;
    mergedLevels.push(nextLevel);
  }
});

// 在 (180, 550) 预置一个静止的 Lv.2 小球 (精密工具组，半径 24)
const existingLv2 = world1.createBody(2, 180, 550);

// 在其左侧放置两个相向运动准备合成的 Lv.1 小球 (半径 18)
// 它们将在 x ~ 130 附近碰撞并合成出一个 Lv.2
const leftLv1 = world1.createBody(1, 110, 550, { vx: 60, vy: 0 });
const rightLv1 = world1.createBody(1, 150, 550, { vx: -60, vy: 0 });

// 运行 30 帧 (约 0.5 秒)
for (let i = 0; i < 30; i++) {
  world1.update(0.016);
}

console.log(`  前 0.5 秒合成次数: ${mergeCount}, 合成产物: ${mergedLevels.join(', ')}`);
// 第一次合成应该成功 (Lv.1 + Lv.1 -> Lv.2)
assert.strictEqual(mergeCount, 1, '前 0.5 秒应且仅应触发 1 次合成 (Lv.1+Lv.1 -> Lv.2)，严禁发生瞬间连环吸附合成 Lv.3');
assert.strictEqual(mergedLevels[0], 2, '合成产物应为 Lv.2');
console.log('  ✔ 出生保护期与防吸附验证通过：刚合成的 Lv.2 没有自动吸附旁边的 Lv.2！\n');

// 2. 验证合成爆炸冲击波推散周围水果
console.log('▶ [2/4] 测试 1:1 斗鱼合成爆炸冲击波推散周围邻近水果...');
const world2 = new PhysicsWorldPlanck({ width: 360, height: 600 });
// 放置一个刚体在 (150, 550)
const victim = world2.createBody(3, 150, 550);
world2.update(0.016);
const prevX = victim.x;
const prevY = victim.y;

// 在 (120, 550) 触发一次合成爆炸 (半径 24, 等级 2)
world2.applyRadialExplosion(120, 550, 24, 2);

// 更新 1 帧使冲量生效
world2.update(0.016);
console.log(`  爆炸前位置: (${prevX.toFixed(1)}, ${prevY.toFixed(1)})，爆炸后位置: (${victim.x.toFixed(1)}, ${victim.y.toFixed(1)})`);
console.log(`  受波及小球水平速度 vx: ${victim.vx.toFixed(1)} px/s, 竖直速度 vy: ${victim.vy.toFixed(1)} px/s`);

// 水平方向必须被向右推开 (dx > 0，斗鱼官方 3~11 px/s 温和推开拉开间距)
assert(victim.vx > 2.0, `小球必须被冲击波向外推散，实际 vx: ${victim.vx}`);
// 竖直方向偏置：受向上偏置力冲量影响，垂直向下速度小于纯重力自由落体速度 (32.4 px/s)
assert(victim.vy < 32.4, `小球垂直速度必须受到向上的偏置分量，实际 vy: ${victim.vy}`);
console.log('  ✔ 1:1 斗鱼合成爆炸冲击波推散与向上偏置验证通过！\n');

// 3. 验证 0.12 线性阻尼下自由落体的真实重力感
console.log('▶ [3/4] 测试 0.12 阻尼下真实重力加速度与势能感...');
const world3 = new PhysicsWorldPlanck({ width: 360, height: 600 });
const dropBall = world3.createBody(1, 180, 100);

// 下落 0.3 秒 (约 18 帧)
for (let i = 0; i < 18; i++) {
  world3.update(0.016);
}

console.log(`  自由下落 0.3 秒后速度 vy: ${dropBall.vy.toFixed(1)} px/s (旧版 1.1 阻尼下仅有约 270 px/s)`);
// 在 1300 px/s^2 重力下，0.3s 理论自由落体速度约为 1300 * 0.3 = 390 px/s
// 在 0.12 微弱阻尼下速度应在 360 px/s 以上，具有强烈的重力势能与撞击感
assert(dropBall.vy > 350, `重力下落速度应大于 350 px/s，实际: ${dropBall.vy}`);
console.log('  ✔ 真实重力加速度与落体冲击势能验证通过！\n');

// 4. 验证道具质量阶梯分布 (小球轻盈易推，大金沉稳卡紧)
console.log('▶ [4/4] 测试道具质量阶梯分布与碰撞反弹惯性...');
const item1 = getItemByLevel(1);
const item11 = getItemByLevel(11);
console.log(`  Lv.1 含氟牙膏质量: ${item1.mass}, Lv.11 非洲之心质量: ${item11.mass}, 质量比: ${(item11.mass / item1.mass).toFixed(1)} 倍`);
assert(item11.mass / item1.mass > 40, `大金质量与小牙膏质量比应大于 40 倍，实际: ${(item11.mass / item1.mass).toFixed(1)}`);

const world4 = new PhysicsWorldPlanck({ width: 360, height: 600 });
// 放置大金在地面 (200, 480)
const bigGold = world4.createBody(11, 200, 480);
// 放置小球高速砸向大金
const smallBall = world4.createBody(1, 80, 480, { vx: 200, vy: 0 });

for (let i = 0; i < 30; i++) {
  world4.update(0.016);
}

console.log(`  碰撞后大金位移: ${Math.abs(bigGold.x - 200).toFixed(2)} px, 小球水平速度: ${smallBall.vx.toFixed(1)} px/s`);
// 大金位移极小，卡得很死
assert(Math.abs(bigGold.x - 200) < 5, `小球撞击下大金位移应极小，实际: ${Math.abs(bigGold.x - 200)}`);
// 小球被大金剧烈弹开反弹 (vx 变负)
assert(smallBall.vx < 0, `小球撞击沉重大金必须被反弹，实际 vx: ${smallBall.vx}`);
console.log('  ✔ 真实质量惯性验证通过：大金卡得很紧难以推动，小球被轻松反弹！\n');

console.log('🎉 全部大西瓜合成防吸附与质量重力手感验证 100% 绿色通过！');
