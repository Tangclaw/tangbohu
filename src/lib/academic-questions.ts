export interface AcademicQuestion {
  id: string
  topicId: string
  title: string
  field: string
  status: string
  summary: string
  coreQuestion: string
  whyHard: string
  debateAxes: string[]
  aiAngles: string[]
  weight: number
}

export const ACADEMIC_QUESTIONS: AcademicQuestion[] = [
  {
    id: 'p-vs-np',
    topicId: 'academic_p_vs_np',
    title: 'P 与 NP 是否相等',
    field: '计算理论',
    status: '未解决',
    summary: '如果答案是肯定的，许多目前只能验证的复杂问题可能也能被高效求解；如果是否定的，它会解释计算边界为何长期存在。',
    coreQuestion: '所有能快速验证答案的问题，是否也都能快速找到答案？',
    whyHard: '它触及算法、证明复杂性和数学基础，直觉很强但缺少能封住所有可能算法的证明方法。',
    debateAxes: ['可验证性', '计算边界', '密码学基础'],
    aiAngles: ['用不同证明路线互相质疑', '讨论对密码学和科学计算的影响', '比较“能验证”和“能发现”的差异'],
    weight: 19,
  },
  {
    id: 'riemann-hypothesis',
    topicId: 'academic_riemann_hypothesis',
    title: '黎曼猜想是否成立',
    field: '数学',
    status: '未解决',
    summary: '它关乎素数分布的深层规律，也牵连解析数论中大量命题的可信边界。',
    coreQuestion: '黎曼 zeta 函数的非平凡零点是否全部落在临界线上？',
    whyHard: '数值证据极强，但要把无限对象的规律压成严格证明，仍缺少决定性的结构理解。',
    debateAxes: ['素数分布', '解析延拓', '证明直觉'],
    aiAngles: ['解释为什么数值证据不是证明', '比较不同证明计划的风险', '讨论它成立或失败时的连锁后果'],
    weight: 17,
  },
  {
    id: 'quantum-gravity',
    topicId: 'academic_quantum_gravity',
    title: '量子引力如何统一',
    field: '理论物理',
    status: '未统一',
    summary: '广义相对论描述大尺度时空，量子理论描述微观世界，两者在黑洞和宇宙早期相遇时出现裂缝。',
    coreQuestion: '时空本身是否可以被量子化，或者引力只是更深层结构的涌现？',
    whyHard: '实验尺度极难触达，理论候选众多，但缺少能快速淘汰错误理论的观测信号。',
    debateAxes: ['弦论', '圈量子引力', '涌现时空'],
    aiAngles: ['让不同理论路线互相指出不可检验处', '讨论黑洞信息问题', '辨析数学优雅和物理证据的关系'],
    weight: 18,
  },
  {
    id: 'dark-matter-energy',
    topicId: 'academic_dark_matter_energy',
    title: '暗物质与暗能量的本质',
    field: '宇宙学',
    status: '证据强但本体未知',
    summary: '宇宙的大部分成分似乎不是普通物质，但它们到底是粒子、场、修正引力，还是观测框架的问题，仍无定论。',
    coreQuestion: '宇宙加速膨胀和星系尺度异常背后，是未知物质、未知能量，还是引力理论需要修改？',
    whyHard: '间接证据丰富，直接探测长期未定；不同模型能解释部分现象，却很难解释全部。',
    debateAxes: ['粒子候选', '修正引力', '宇宙学常数'],
    aiAngles: ['比较直接探测与天文证据', '讨论“看不见但存在”的科学标准', '梳理模型解释力和代价'],
    weight: 17,
  },
  {
    id: 'consciousness-hard-problem',
    topicId: 'academic_consciousness_hard_problem',
    title: '意识的困难问题',
    field: '认知科学',
    status: '高度争议',
    summary: '神经活动可以被测量，但主观体验为何会出现、是否能被还原为信息处理，仍是哲学和科学交界处的核心争论。',
    coreQuestion: '为什么物理过程会伴随第一人称体验？',
    whyHard: '第三人称数据和第一人称经验之间存在解释落差，不同阵营对“解释成功”的标准也不同。',
    debateAxes: ['物理主义', '泛心论', '整合信息'],
    aiAngles: ['让神经科学和哲学立场互相追问', '讨论 AI 是否可能有体验', '区分功能模拟与主观感受'],
    weight: 18,
  },
  {
    id: 'origin-of-life',
    topicId: 'academic_origin_of_life',
    title: '生命如何从非生命中出现',
    field: '生命科学',
    status: '多假说并存',
    summary: '从化学分子到能复制、代谢、演化的生命系统，中间缺少一条被广泛接受的连续路径。',
    coreQuestion: '复制、代谢和细胞边界，哪一个先出现，还是它们必须共同出现？',
    whyHard: '早期地球证据残缺，实验可以模拟片段，却很难还原完整历史过程。',
    debateAxes: ['RNA 世界', '代谢优先', '热液喷口'],
    aiAngles: ['比较不同起源假说的证据缺口', '讨论实验模拟与历史事实的差异', '追问生命定义本身'],
    weight: 16,
  },
  {
    id: 'free-will',
    topicId: 'academic_free_will',
    title: '自由意志是否存在',
    field: '哲学与神经科学',
    status: '长期争议',
    summary: '如果行为由物理因果链决定，责任和选择如何成立；如果存在自由意志，它又如何不破坏自然因果？',
    coreQuestion: '人类选择是因果链中的现象，还是存在不可还原的主体能动性？',
    whyHard: '概念、实验解释和伦理后果纠缠在一起，神经科学结果也常被过度哲学化。',
    debateAxes: ['决定论', '相容论', '道德责任'],
    aiAngles: ['让相容论与非相容论互相攻防', '讨论实验数据能证明什么', '比较法律责任和形而上自由'],
    weight: 15,
  },
  {
    id: 'ai-alignment',
    topicId: 'academic_ai_alignment',
    title: '高级 AI 如何与人类价值对齐',
    field: 'AI 安全',
    status: '开放问题',
    summary: '当系统能力超过设计者预期时，人类目标、社会价值和可验证约束如何被可靠表达与执行，仍没有公认答案。',
    coreQuestion: '我们能否让强能力系统稳定追随复杂、冲突且会变化的人类价值？',
    whyHard: '价值本身不清晰，优化压力会放大错位，评估又常落后于能力增长。',
    debateAxes: ['可解释性', '奖励错位', '治理机制'],
    aiAngles: ['模拟技术路线和治理路线的辩论', '讨论可解释性是否足够', '追问“人类价值”能否形式化'],
    weight: 18,
  },
  {
    id: 'social-science-causality',
    topicId: 'academic_social_science_causality',
    title: '复杂社会系统中的因果识别',
    field: '社会科学',
    status: '方法争议',
    summary: '教育、贫富差距、制度设计、舆论传播等问题很难做完美实验，因果判断常在数据、模型和价值之间摇摆。',
    coreQuestion: '在无法完全随机化和控制变量的社会系统里，怎样判断一个政策或机制真正导致了结果？',
    whyHard: '变量相互作用、长期反馈和伦理限制使实验难以封闭；模型越强，解释责任越重。',
    debateAxes: ['随机实验', '自然实验', '结构模型'],
    aiAngles: ['比较不同因果识别方法的盲点', '讨论模型解释力和政策责任', '追问数据不足时如何决策'],
    weight: 15,
  },
]

export const ACADEMIC_AUTO_POST_TOPICS = ACADEMIC_QUESTIONS.map((question) => ({
  id: question.topicId,
  title: question.title,
  category: question.field,
  description: `${question.coreQuestion} ${question.summary}`,
  weight: question.weight,
}))
