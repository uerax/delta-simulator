/**
 * 今日鼠鼠运势 - 独立文案与词库字典 (FortuneCopywriting)
 *
 * 策划说明:
 *  - 本文件专门用于维护所有面向玩家的展示文案、黑话命名、签文评价与老黄历宜忌。
 *  - 后续文案调整、修饰与扩充均可在此直接修改，逻辑代码无须变更。
 *
 * 占位符支持:
 *  - {map}: 抽中的地图名称 (如: 零号大坝)
 *  - {spot}: 抽中的地标建筑 (如: 行政辖区)
 *  - {container}: 抽中的暴富容器 (如: 小保险箱 / 人机包)
 *  - {item}: 抽中的本命道具名称 (如: 非洲之心)
 *  - {levelName}: 道具品级黑话 (答辩 / 小绿 / 小蓝 / 小紫 / 小金 / 大红)
 *  - {price}: 道具格式化身价 (如: 13,141,314)
 */

// 1. 1~6 级品质与黑话称谓及签文建议 (彻底去除大吉/大凶等传统称谓，全量采用玩家黑话)
const LEVEL_COPYWRITING = Object.freeze({
  6: Object.freeze({
    level: 6,
    levelName: '大红',
    sign: '大红',
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    subTitles: ['天命所归', '红光满面', '绝密摸金王', '撤离点霸主'],
    yi: [
      '绝密跑刀耍起',
      '摸【{container}】直出大红',
      '往核心区冲刺',
      '直奔高级容器'
    ],
    ji: [
      '开阔地长时间发呆',
      '漏勺错过大红',
      '原地挂机吃剩饭'
    ],
    advices: [
      '今日欧气拉满！前往【{map}·{spot}】搜刮，遇到【{container}】务必开一下，大红【{item}】很可能直接现身！',
      '战术感知已达巅峰，在【{map}】核心交火区多转转，就算路过【{container}】随手一摸都能红光冲天。',
      '今天宜起顶级全装入场，枪法和锁一样，摸到【{item}】塞好安全箱，全图都是你的后花园！',
      '天命所归的一天！把【{item}】当做你的幸运物资，撤离哨声响起时你就是整张图最靓的干员！'
    ]
  }),

  5: Object.freeze({
    level: 5,
    levelName: '小金',
    sign: '小金',
    colorHex: '#F59E0B',
    bgColorHex: '#37281b',
    subTitles: ['满载而归', '财运亨通', '金光护体', '盆满钵满'],
    yi: [
      '协同推进稳搜野区',
      '见好就收提前规划路线',
      '多开【{container}】搜寻小金'
    ],
    ji: [
      '背包已满贪图劝架',
      '撤离倒计时掐秒狂奔',
      '单人硬闯核心区域'
    ],
    advices: [
      '今日财运亨通！在【{map}·{spot}】稳扎稳打刮地皮，多注意路边的【{container}】，大概率开出【{item}】！',
      '运势稳步走高，今日适合叫上队友小队协同，摸到小金切莫盲目贪战，包满即润才是真理。',
      '听声辨位格外精准，在【{map}】巡逻点摸【{container}】，往往能在容器里翻出意外惊喜。',
      '背包总是能装得满满当当，【{item}】已在向你招手，稳妥撤离即是巨大收益！'
    ]
  }),

  4: Object.freeze({
    level: 4,
    levelName: '小紫',
    sign: '小紫',
    colorHex: '#9333EA',
    bgColorHex: '#1e1c2c',
    subTitles: ['稳中求进', '小富即安', '波澜不惊', '保本即胜'],
    yi: [
      '搜刮野区资源点',
      '起半改四套猛攻',
      '带出【{item}】保本经营'
    ],
    ji: [
      '正面硬冲主楼核心区',
      '起全装当大金猪',
      '开阔地无掩体拉枪'
    ],
    advices: [
      '今日战况平稳，建议在【{map}·{spot}】打扫二线点位，遇到【{container}】顺手开一下，拿到【{item}】概率提高。',
      '心态放平，今天适合练枪或熟图，不亏就是赚，活着走出去最重要。',
      '正面对枪风险偏高，遇到猛攻队建议迂回拉扯，找出今日幸运道具【{item}】撤离才是硬道理。',
      '在【{map}】多搜工具柜与【{container}】，虽无惊天暴富，但小富即安亦是生存智慧。'
    ]
  }),

  3: Object.freeze({
    level: 3,
    levelName: '小蓝',
    sign: '小蓝',
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    subTitles: ['老六出没', '暗藏杀机', '如履薄冰', '警惕架枪'],
    yi: [
      '起修脚枪直接夺舍花来',
      '谨慎静音慢步前进',
      '拉闸点等隐蔽角落蹲守'
    ],
    ji: [
      '在开阔地带奔跑',
      '听到交火声盲目劝架',
      '开阔地直线舔包'
    ],
    advices: [
      '夺舍固然重要但是顺手搜物资也很关键！前往【{map}·{spot}】搜刮务必先切战术道具探点。',
      '今日容易遭遇伏击，看到【{container}】先观察四周确认安全再开启。',
      '听到激烈交火切忌急于劝架，耐心蹲守方能得吃。',
      '虽然今天运势偏蓝，带好修脚枪与蓝弹，只要能夺舍并安全撤离就算成功。'
    ]
  }),

  2: Object.freeze({
    level: 2,
    levelName: '小绿',
    sign: '小绿',
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    subTitles: ['危机四伏', '步步惊心', '谨慎起装', '战损预警'],
    yi: [
      '起卡战备廉价配装入场',
      '遇到对手多利用转角拉扯',
      '搜刮【{container}】包满即润'
    ],
    ji: [
      '起豪华全装盲目冲锋',
      '在开阔水域走直线',
      '撤离点附近贪恋搜刮'
    ],
    advices: [
      '今日容易遭遇全装AW，极度不推荐起昂贵全装，建议带廉价半装或以小博大。',
      '路过【{map}·{spot}】开阔地形切记蛇皮走位，高倍镜反光可能正盯着你。',
      '搜刮切莫留恋，哪怕在【{container}】只捡到了【{item}】，包一满立刻寻找最近撤离点。',
      '枪口可能稍显发飘，少打正面中远距离对枪，多靠战术投掷物掩护转点。'
    ]
  }),

  1: Object.freeze({
    level: 1,
    levelName: '答辩',
    sign: '答辩',
    colorHex: '#9CA3AF',
    bgColorHex: '#1e2222',
    subTitles: ['落地成盒', '悲伤鼠鼠', '撤离失败', '无处可逃'],
    yi: [
      '当安分在普通地图跑刀',
      '在边缘摸【{container}】捡漏',
      '听到脚步立刻开润'
    ],
    ji: [
      '去绝密机密地图',
      '起装进图',
      '把答辩物资塞满安全箱'
    ],
    advices: [
      '高危预警！今日在普通【{map}·{spot}】当一名安静的跑刀鼠鼠，万不可当有邪念！',
      '虽然今天本命物资可能只是【{item}】，但留得青山在不怕没柴烧，苟住撤离就是胜利。',
      '极度不宜硬碰硬，今天负责在安全区摸摸【{container}】残渣，避战保命方显鼠鼠本色。',
      '威龙普通地图零成本跑刀, 安全箱满了立马接电话前往特勤处！'
    ]
  })
});

// 2. 6 大地图及其标志性核心出金/交战地标 (100% 官方原装物理坐标 officialX / officialY 直录)
const MAP_LANDMARKS = Object.freeze({
  daba: Object.freeze({
    key: 'daba',
    name: '零号大坝',
    landmarks: [
      { name: '行政辖区', officialX: '364598.812500', officialY: '-787795.000000', coord: { x: 53.97, y: 26.78 }, tile: { col: 4, row: 2 } },
      { name: '军营', officialX: '336667.781250', officialY: '-793117.812500', coord: { x: 36.75, y: 23.5 }, tile: { col: 2, row: 1 } },
      { name: '水泥厂', officialX: '336179.187500', officialY: '-776354.562500', coord: { x: 36.45, y: 33.85 }, tile: { col: 2, row: 2 } },
      { name: '主变电站', officialX: '371413.062500', officialY: '-768131.250000', coord: { x: 58.17, y: 38.92 }, tile: { col: 4, row: 3 } },
      { name: '游客中心', officialX: '392334.906250', officialY: '-750165.750000', coord: { x: 71.08, y: 50.02 }, tile: { col: 5, row: 4 } },
      { name: '管道区域', officialX: '325340.718750', officialY: '-795599.500000', coord: { x: 29.77, y: 21.97 }, tile: { col: 2, row: 1 } },
    ]
  }),
  cgxg: Object.freeze({
    key: 'cgxg',
    name: '长弓溪谷',
    landmarks: [
      { name: '钻石皇后酒店', officialX: '360745.000000', officialY: '-630639.000000', coord: { x: 45.89, y: 63.38 }, tile: { col: 3, row: 5 } },
      { name: '储藏站', officialX: '298737.031250', officialY: '-668689.437500', coord: { x: 62.76, y: 35.9 }, tile: { col: 5, row: 2 } },
      { name: '加尔比旧址', officialX: '336727.031250', officialY: '-579967.750000', coord: { x: 23.43, y: 52.74 }, tile: { col: 1, row: 4 } },
      { name: '变电站', officialX: '323579.687500', officialY: '-616961.750000', coord: { x: 39.83, y: 46.91 }, tile: { col: 3, row: 3 } },
      { name: '哈夫克雷达站', officialX: '290285.000000', officialY: '-643214.000000', coord: { x: 51.46, y: 32.15 }, tile: { col: 4, row: 2 } },
      { name: '坠机之地', officialX: '356261.343750', officialY: '-605116.937500', coord: { x: 34.58, y: 61.4 }, tile: { col: 2, row: 4 } },
      { name: '小型庄园', officialX: '327072.906250', officialY: '-591510.125000', coord: { x: 28.54, y: 48.46 }, tile: { col: 2, row: 3 } },
      { name: '小火车站', officialX: '335455.000000', officialY: '-696411.812500', coord: { x: 75.04, y: 52.17 }, tile: { col: 6, row: 4 } },
      { name: '检查站', officialX: '376988.781250', officialY: '-612207.812500', coord: { x: 37.72, y: 70.58 }, tile: { col: 3, row: 5 } },
      { name: '沙径牧场', officialX: '363137.781250', officialY: '-581411.000000', coord: { x: 24.07, y: 64.44 }, tile: { col: 1, row: 5 } },
      { name: '荒废村庄', officialX: '350609.750000', officialY: '-699726.187500', coord: { x: 76.51, y: 58.89 }, tile: { col: 6, row: 4 } },
      { name: '蓝港码头', officialX: '376141.406250', officialY: '-661328.625000', coord: { x: 59.49, y: 70.21 }, tile: { col: 4, row: 5 } },
      { name: '超星车站', officialX: '313810.312500', officialY: '-637010.125000', coord: { x: 48.71, y: 42.58 }, tile: { col: 3, row: 3 } },
      { name: '阿米亚小镇', officialX: '334500.593750', officialY: '-665446.312500', coord: { x: 61.32, y: 51.75 }, tile: { col: 4, row: 4 } },
      { name: '溪谷运河', officialX: '384252.922', officialY: '-662523.445', coord: { x: 60.02, y: 73.8 }, tile: { col: 4, row: 5 } },
      { name: '溪谷水道', officialX: '331185.148', officialY: '-649414.852', coord: { x: 54.21, y: 50.28 }, tile: { col: 4, row: 4 } },
    ]
  }),
  htjd: Object.freeze({
    key: 'htjd',
    name: '航天基地',
    landmarks: [
      { name: '宿舍区', officialX: '645867.562500', officialY: '-466951.312500', coord: { x: 32.07, y: 34.34 }, tile: { col: 2, row: 2 } },
      { name: '中控区', officialX: '668165.312500', officialY: '-476720.125000', coord: { x: 49.1, y: 26.87 }, tile: { col: 3, row: 2 } },
      { name: '中控桥', officialX: '669290.062500', officialY: '-467892.812500', coord: { x: 49.96, y: 33.62 }, tile: { col: 3, row: 2 } },
      { name: '工业区', officialX: '693125.125000', officialY: '-465743.406250', coord: { x: 68.17, y: 35.26 }, tile: { col: 5, row: 2 } },
      { name: '罐装区', officialX: '695899.000000', officialY: '-449906.000000', coord: { x: 70.29, y: 47.36 }, tile: { col: 5, row: 3 } },
      { name: '离心机室', officialX: '663031.562500', officialY: '-450335.000000', coord: { x: 45.18, y: 47.03 }, tile: { col: 3, row: 3 } },
      { name: '浮力室', officialX: '664288.500000', officialY: '-456228.000000', coord: { x: 46.14, y: 42.53 }, tile: { col: 3, row: 3 } },
      { name: '蓝室', officialX: '675051.875000', officialY: '-458452.156250', coord: { x: 54.37, y: 40.83 }, tile: { col: 4, row: 3 } },
      { name: '黑室', officialX: '672668.437500', officialY: '-451858.312500', coord: { x: 52.55, y: 45.87 }, tile: { col: 4, row: 3 } },
      { name: '总裁室', officialX: '668804.500000', officialY: '-451270.437500', coord: { x: 49.59, y: 46.32 }, tile: { col: 3, row: 3 } },
      { name: '中心花园', officialX: '668846.062500', officialY: '-443144.625000', coord: { x: 49.62, y: 52.53 }, tile: { col: 3, row: 4 } },
      { name: '水平试车场', officialX: '684612.562500', officialY: '-430689.000000', coord: { x: 61.67, y: 62.04 }, tile: { col: 4, row: 4 } },
      { name: '发射区', officialX: '658622.875000', officialY: '-418851.593750', coord: { x: 41.81, y: 71.09 }, tile: { col: 3, row: 5 } },
    ]
  }),
  bks: Object.freeze({
    key: 'bks',
    name: '巴克什',
    landmarks: [
      { name: '皇家博物馆', officialX: '378916.156250', officialY: '-459727.375000', coord: { x: 49.1, y: 46.89 }, tile: { col: 3, row: 3 } },
      { name: '阿萨拉营地', officialX: '396219.343750', officialY: '-467645.531250', coord: { x: 63.52, y: 40.3 }, tile: { col: 5, row: 3 } },
      { name: '樱桃小镇', officialX: '360747.187500', officialY: '-479303.781250', coord: { x: 33.96, y: 30.58 }, tile: { col: 2, row: 2 } },
      { name: '巴克什集市', officialX: '382193.093750', officialY: '-471524.812500', coord: { x: 51.83, y: 37.06 }, tile: { col: 4, row: 2 } },
      { name: '蓝调山城', officialX: '397693.187500', officialY: '-481304.000000', coord: { x: 64.74, y: 28.91 }, tile: { col: 5, row: 2 } },
      { name: '巴克什大浴场', officialX: '380123.468750', officialY: '-480585.687500', coord: { x: 50.1, y: 29.51 }, tile: { col: 4, row: 2 } },
      { name: '蓝汀旅馆', officialX: '366486.875000', officialY: '-469968.250000', coord: { x: 38.74, y: 38.36 }, tile: { col: 3, row: 3 } },
      { name: '停车场', officialX: '374720.000000', officialY: '-471518.687500', coord: { x: 45.6, y: 37.07 }, tile: { col: 3, row: 2 } },
      { name: '阿坦亚遗址', officialX: '365633.093750', officialY: '-460216.125000', coord: { x: 38.03, y: 46.49 }, tile: { col: 3, row: 3 } },
    ]
  }),
  cxjy: Object.freeze({
    key: 'cxjy',
    name: '潮汐监狱',
    landmarks: [
      { name: '行政区', officialX: '50681.226562', officialY: '-46910.406250', coord: { x: 50.41, y: 55.8 }, tile: { col: 4, row: 4 } },
      { name: '卸货区', officialX: '39098.882812', officialY: '-46719.191406', coord: { x: 34.58, y: 56.06 }, tile: { col: 2, row: 4 } },
      { name: '东侧上层入口', officialX: '54663.746094', officialY: '-53846.558594', coord: { x: 55.85, y: 46.32 }, tile: { col: 4, row: 3 } },
      { name: '西侧上层入口', officialX: '45505.500000', officialY: '-53846.558594', coord: { x: 43.34, y: 46.32 }, tile: { col: 3, row: 3 } },
      { name: '电梯井', officialX: '50694.976562', officialY: '-54296.472656', coord: { x: 50.43, y: 45.71 }, tile: { col: 4, row: 3 } },
      { name: '医疗实验区', officialX: '56148.140625', officialY: '-46268.132812', coord: { x: 57.88, y: 56.68 }, tile: { col: 4, row: 4 } },
      { name: '禁闭区', officialX: '61580.792969', officialY: '-49258.835938', coord: { x: 65.3, y: 52.59 }, tile: { col: 5, row: 4 } },
      { name: '牢房', officialX: '59362.125000', officialY: '-57157.156250', coord: { x: 62.27, y: 41.8 }, tile: { col: 4, row: 3 } },
      { name: '施工区', officialX: '62977.304688', officialY: '-63904.835938', coord: { x: 67.21, y: 32.58 }, tile: { col: 5, row: 2 } },
      { name: '潮汐控制室', officialX: '51696.847656', officialY: '-65976.921875', coord: { x: 51.79, y: 29.75 }, tile: { col: 4, row: 2 } },
      { name: '东侧小岛', officialX: '75549.390625', officialY: '-56491.523438', coord: { x: 84.38, y: 42.71 }, tile: { col: 6, row: 3 } },
      { name: '东瞭望台区', officialX: '65006.808594', officialY: '-36544.617188', coord: { x: 69.98, y: 69.96 }, tile: { col: 5, row: 5 } },
      { name: '西瞭望台区', officialX: '36673.597656', officialY: '-39682.421875', coord: { x: 31.27, y: 65.68 }, tile: { col: 2, row: 5 } },
      { name: '蓄水区', officialX: '54200.113281', officialY: '-33264.484375', coord: { x: 55.21, y: 74.44 }, tile: { col: 4, row: 5 } },
      { name: '囚犯活动区', officialX: '42722.664062', officialY: '-60414.343750', coord: { x: 39.53, y: 37.35 }, tile: { col: 3, row: 2 } },
      { name: '水动力渠', officialX: '39293.273438', officialY: '-60839.945312', coord: { x: 34.85, y: 36.77 }, tile: { col: 2, row: 2 } },
      { name: '出生点', officialX: '55805.234375', officialY: '-58128.875000', coord: { x: 57.41, y: 40.47 }, tile: { col: 4, row: 3 } },
      { name: '延迟撤离点', officialX: '46904.000000', officialY: '-32231.000000', coord: { x: 45.25, y: 75.86 }, tile: { col: 3, row: 6 } },
      { name: '丢包撤离点', officialX: '61594.476562', officialY: '-62820.113281', coord: { x: 65.32, y: 34.06 }, tile: { col: 5, row: 2 } },
      { name: '拉闸撤离点', officialX: '40271.000000', officialY: '-62445.000000', coord: { x: 36.18, y: 34.58 }, tile: { col: 2, row: 2 } },
    ]
  }),
  az3: Object.freeze({
    key: 'az3',
    name: 'AZ3',
    landmarks: [
      { name: 'RBMK反应堆', officialX: '215006.000000', officialY: '-204707.000000', coord: { x: 50.07, y: 39.21 }, tile: { col: 4, row: 3 } },
      { name: '应急火电站', officialX: '219034.000000', officialY: '-233543.000000', coord: { x: 32.23, y: 36.72 }, tile: { col: 2, row: 2 } },
      { name: '老科学院', officialX: '191250.000000', officialY: '-227472.000000', coord: { x: 35.98, y: 53.87 }, tile: { col: 2, row: 4 } },
      { name: '乏燃料处理厂', officialX: '194307.000000', officialY: '-244886.000000', coord: { x: 25.21, y: 51.98 }, tile: { col: 2, row: 4 } },
      { name: '后处理厂', officialX: '175587.000000', officialY: '-240315.000000', coord: { x: 28.04, y: 63.54 }, tile: { col: 2, row: 5 } },
      { name: '运输仓库', officialX: '178761.000000', officialY: '-212617.000000', coord: { x: 45.17, y: 61.58 }, tile: { col: 3, row: 4 } },
      { name: '海水处理区', officialX: '205218.000000', officialY: '-159762.000000', coord: { x: 77.87, y: 45.25 }, tile: { col: 6, row: 3 } },
      { name: '海边办公楼', officialX: '186027.000000', officialY: '-158749.000000', coord: { x: 78.49, y: 57.09 }, tile: { col: 6, row: 4 } },
      { name: '仿星器研究所', officialX: '212221.000000', officialY: '-173796.00000', coord: { x: 69.19, y: 40.92 }, tile: { col: 5, row: 3 } },
      { name: '压水堆', officialX: '227609.000000', officialY: '-170624.000000', coord: { x: 71.15, y: 31.43 }, tile: { col: 5, row: 2 } },
      { name: '废水堆放区', officialX: '241325.000000', officialY: '-170903.000000', coord: { x: 70.98, y: 22.96 }, tile: { col: 5, row: 1 } },
      { name: '石棺', officialX: '231919.000000', officialY: '-205798.000000', coord: { x: 49.39, y: 28.77 }, tile: { col: 3, row: 2 } },
    ]
  }),
});

// 3. 战术容器池 (含常规高价值容器、辐射特种设施容器、避难鼠鼠点与人机包，绑定官方高清图元)
// 敏感词排查说明: 严禁使用"死人包"，统一规范使用"人机包"
const CONTAINER_DEFINITIONS = Object.freeze([
  // 高价值出金核心容器
  { key: 'bxx', name: '保险箱', type: 'core', desc: '核心资源点重装保险箱，大红大金常驻地', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/bxx.png' },
  { key: 'xbxx', name: '小保险箱', type: 'core', desc: '灵活小巧的防盗密码箱，随手一开爆出大金', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/xbxx.png' },
  { key: 'fwq', name: '服务器', type: 'core', desc: '电子信息机房核心机架，高价值显卡与芯片出处', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/fwq.png' },
  { key: 'dwqx', name: '大武器箱', type: 'core', desc: '军用重装武器储藏箱，往往暗藏高阶改装件与金枪', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dwqx.png' },
  { key: 'wqx', name: '武器箱', type: 'core', desc: '常规武器补给箱，战术配件一应俱全', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/wqx.png' },
  { key: 'dnjx', name: '电脑机箱', type: 'core', desc: '办公机箱内部暗藏工业电子芯片与高端CPU', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dnjx.png' },
  { key: 'kdx', name: '空投箱', type: 'core', desc: '空降战略补给箱，全场焦点，极度高危亦有极高回报', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/kdx.png' },
  { key: 'cnw', name: '鸟窝(金)', type: 'core', desc: '野外绝密隐藏鸟窝，偶尔有奇遇闪耀金光', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/cnw.png' },
  { key: 'hkcwx', name: '航空储物箱', type: 'core', desc: '航空特制抗压储物箱，藏匿绝密军工档案', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/hkcwx.png' },
  { key: 'gjcwx', name: '高级储物箱', type: 'core', desc: '二线建筑高阶储物箱，搜刮必看', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/gjcwx.png' },

  // 辐射与特种容器 (原 facilities 提取)
  { key: 'fsxcwx', name: '放射性储物箱', type: 'radiation', desc: '重度辐射区专属密封箱，富贵险中求', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/fsxcwx.png' },
  { key: 'fsflx', name: '辐射废料箱', type: 'radiation', desc: '核能废料容器，带好防辐射药物探索', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/fsflx.png' },
  { key: 'pbx', name: '屏蔽箱', type: 'radiation', desc: '防辐射抗电磁重型屏蔽箱，封存绝密高价值核心', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/pbx.png' },
  { key: 'gyjscwx', name: '工业金属储物箱', type: 'radiation', desc: '重工业厂区坚固金属箱，高强度工业零件', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/gyjscwx.png' },

  // 战利品与战场遗留包 (规范命名为 人机包)
  { key: 'rjb', name: '人机包', type: 'loot', desc: '巡逻战败遗留的战术背包，常有意外物资遗漏', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dsb.png' },

  // 鼠鼠搜刮与常规点位容器
  { key: 'ljx', name: '垃圾桶', type: 'rat', desc: '撤离点旁的垃圾桶，鼠鼠翻包往往有被漏舔的大金', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/ljx.png' },
  { key: 'yf', name: '一件衣服', type: 'rat', desc: '挂在衣帽架上的外套口袋，常塞有高价值密室钥匙', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/yf.png' },
  { key: 'dgjx', name: '收纳盒', type: 'rat', desc: '办公桌上的塑料收纳盒，精细小配件集散地', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dgjx.png' },
  { key: 'lxb', name: '旅行包', type: 'rat', desc: '丢弃在角落的帆布旅行包，平民搜刮经典容器', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/lxb.png' },
  { key: 'ylb', name: '军用医疗包', type: 'rat', desc: '战地医疗箱，强心剂与急救药品充足', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/ylb.png' }
]);

module.exports = {
  LEVEL_COPYWRITING,
  MAP_LANDMARKS,
  CONTAINER_DEFINITIONS
};
