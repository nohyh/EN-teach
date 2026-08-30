export type CoursePresentation = {
  scene: string;
  journey: Array<{ place: string; title: string }>;
  wordActionLabel: string;
  sentenceActionLabel: string;
  sentencePattern?: { prefix: string; suffix: string };
  dialogDescription: string;
  quickReplies: string[];
  acceptedAnswers: string[];
  completionTitle: string;
  completionMessage: string;
  rewardName: string;
};

const presentations: Record<string, CoursePresentation> = {
  mistake_review: {
    scene: "错题修炼场",
    journey: [{ place: "回忆站", title: "重新读懂题目" }, { place: "辨析桥", title: "找出上次的误区" }, { place: "巩固塔", title: "独立答对一次" }],
    wordActionLabel: "我记住了 →",
    sentenceActionLabel: "继续巩固 →",
    dialogDescription: "把容易混淆的知识重新说清楚",
    quickReplies: [],
    acceptedAnswers: [],
    completionTitle: "错题变成新技能啦！",
    completionMessage: "不是把答案看一遍，而是重新答对一次。需要加强的题会继续留在错题本。",
    rewardName: "纠错小侦探",
  },
  lesson_01_greetings: {
    scene: "小镇广场",
    journey: [{ place: "小镇入口", title: "遇见新朋友" }, { place: "喷泉旁", title: "练习第一次问候" }, { place: "广场中央", title: "勇敢介绍自己" }, { place: "告别路口", title: "完成问候挑战" }],
    wordActionLabel: "记住这个朋友 →",
    sentenceActionLabel: "带上这句问候 →",
    sentencePattern: { prefix: "Hello", suffix: "新朋友" },
    dialogDescription: "向新朋友问好并介绍自己",
    quickReplies: ["Hello! I'm Amy.", "Hi! My name is Tom."],
    acceptedAnswers: ["hello", "hi", "my name", "i'm", "i am"],
    completionTitle: "你完成了第一次问候！",
    completionMessage: "你已经能勇敢地向新朋友打招呼啦。",
    rewardName: "问候小达人",
  },
  lesson_02_colors: {
    scene: "彩虹画室",
    journey: [{ place: "彩虹门", title: "发现新的颜色" }, { place: "颜料桌", title: "认出颜色单词" }, { place: "画布前", title: "说出你看到的颜色" }, { place: "彩虹桥", title: "完成颜色挑战" }],
    wordActionLabel: "收进调色盘 →",
    sentenceActionLabel: "画出这句话 →",
    sentencePattern: { prefix: "It is", suffix: "颜色" },
    dialogDescription: "告诉 Lumi 你看到了什么颜色",
    quickReplies: ["It is red.", "I see blue."],
    acceptedAnswers: ["red", "blue", "yellow", "green", "purple", "orange"],
    completionTitle: "你点亮了彩虹世界！",
    completionMessage: "每一种颜色都被你用英语叫出了名字。",
    rewardName: "彩虹画家",
  },
  lesson_03_numbers: {
    scene: "数字乐园",
    journey: [{ place: "数字门", title: "遇见数字朋友" }, { place: "积木台", title: "数一数有多少" }, { place: "跳格子", title: "大声说出数字" }, { place: "计数塔", title: "完成数字挑战" }],
    wordActionLabel: "收下数字卡 →",
    sentenceActionLabel: "继续数一数 →",
    sentencePattern: { prefix: "I have", suffix: "数量＋物品" },
    dialogDescription: "用英语告诉 Lumi 你数到了几",
    quickReplies: ["I see three.", "I have five."],
    acceptedAnswers: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
    completionTitle: "数字小队集合完毕！",
    completionMessage: "从 one 到 ten，你已经能大声数出来了。",
    rewardName: "计数队长",
  },
  lesson_04_family: {
    scene: "温暖的家",
    journey: [{ place: "家门口", title: "认识家人称呼" }, { place: "客厅里", title: "介绍你的家人" }, { place: "相册前", title: "认出每位家人" }, { place: "全家福", title: "完成家庭挑战" }],
    wordActionLabel: "放进家庭相册 →",
    sentenceActionLabel: "学会介绍家人 →",
    sentencePattern: { prefix: "This is my", suffix: "家人" },
    dialogDescription: "向 Lumi 介绍一位你的家人",
    quickReplies: ["This is my mom.", "He is my dad."],
    acceptedAnswers: ["mom", "mother", "dad", "father", "sister", "brother", "family"],
    completionTitle: "你完成了家庭介绍！",
    completionMessage: "现在你可以用英语介绍温暖的家啦。",
    rewardName: "家庭讲解员",
  },
  lesson_05_food: {
    scene: "美味餐厅",
    journey: [{ place: "餐厅门口", title: "发现美味食物" }, { place: "点餐台", title: "认出食物单词" }, { place: "餐桌旁", title: "说出喜欢的食物" }, { place: "收银台", title: "完成点餐挑战" }],
    wordActionLabel: "放进美食篮 →",
    sentenceActionLabel: "带上这句表达 →",
    sentencePattern: { prefix: "I like", suffix: "喜欢的食物" },
    dialogDescription: "告诉店员你喜欢什么食物",
    quickReplies: ["I like apples.", "I like bananas."],
    acceptedAnswers: ["apple", "banana", "orange", "bread", "milk", "rice", "cake", "like"],
    completionTitle: "你完成了美食冒险！",
    completionMessage: "你已经能用英语说出喜欢的食物了。",
    rewardName: "美食小达人",
  },
  lesson_06_animals: {
    scene: "动物公园",
    journey: [{ place: "公园入口", title: "遇见动物朋友" }, { place: "熊猫馆", title: "认出动物单词" }, { place: "草地旁", title: "描述动物动作" }, { place: "观景台", title: "完成动物挑战" }],
    wordActionLabel: "收进动物图鉴 →",
    sentenceActionLabel: "继续观察动物 →",
    sentencePattern: { prefix: "It is a", suffix: "动物" },
    dialogDescription: "告诉 Lumi 你喜欢哪种动物",
    quickReplies: ["I like pandas.", "It is a tiger."],
    acceptedAnswers: ["panda", "tiger", "cat", "dog", "bird", "fish", "animal"],
    completionTitle: "动物朋友都认识你啦！",
    completionMessage: "你已经能用英语叫出这些动物朋友了。",
    rewardName: "动物观察员",
  },
  lesson_07_school: {
    scene: "快乐学校",
    journey: [{ place: "校门口", title: "走进英语校园" }, { place: "课桌旁", title: "认识学习用品" }, { place: "教室里", title: "练习课堂表达" }, { place: "放学路", title: "完成校园挑战" }],
    wordActionLabel: "放进小书包 →",
    sentenceActionLabel: "带进教室里 →",
    sentencePattern: { prefix: "This is my", suffix: "学习用品" },
    dialogDescription: "向同学介绍你的学习用品",
    quickReplies: ["This is my book.", "I have a pencil."],
    acceptedAnswers: ["book", "bag", "pencil", "pen", "ruler", "school", "classroom"],
    completionTitle: "你完成了校园挑战！",
    completionMessage: "书包里的英语单词都被你找到了。",
    rewardName: "校园小明星",
  },
  lesson_08_body: {
    scene: "身体律动馆",
    journey: [{ place: "镜子前", title: "认识身体部位" }, { place: "音乐区", title: "跟着指令动一动" }, { place: "律动台", title: "说出身体名称" }, { place: "终点线", title: "完成身体挑战" }],
    wordActionLabel: "记进身体图卡 →",
    sentenceActionLabel: "跟着指令动一动 →",
    sentencePattern: { prefix: "Touch your", suffix: "身体部位" },
    dialogDescription: "听懂并说出身体部位",
    quickReplies: ["This is my hand.", "Touch your nose."],
    acceptedAnswers: ["head", "hand", "arm", "leg", "eye", "ear", "nose", "mouth"],
    completionTitle: "身体律动挑战完成！",
    completionMessage: "你已经能边说英语边动起来了。",
    rewardName: "律动小达人",
  },
  lesson_09_weather: {
    scene: "云朵气象站",
    journey: [{ place: "观测台", title: "看看今天的天空" }, { place: "云朵区", title: "认识天气单词" }, { place: "播报室", title: "练习天气表达" }, { place: "彩虹顶", title: "完成天气挑战" }],
    wordActionLabel: "收进天气手册 →",
    sentenceActionLabel: "完成天气播报 →",
    sentencePattern: { prefix: "It is", suffix: "天气" },
    dialogDescription: "告诉 Lumi 今天是什么天气",
    quickReplies: ["It is sunny.", "It is rainy today."],
    acceptedAnswers: ["sunny", "rainy", "cloudy", "windy", "snowy", "weather"],
    completionTitle: "天气播报成功！",
    completionMessage: "你已经能用英语描述天空的样子了。",
    rewardName: "小小天气员",
  },
  lesson_10_daily_routine: {
    scene: "清晨小屋",
    journey: [{ place: "小床边", title: "开始新的一天" }, { place: "洗漱间", title: "认识早晨动作" }, { place: "早餐桌", title: "说出日常安排" }, { place: "出发门", title: "完成早晨挑战" }],
    wordActionLabel: "记进日程表 →",
    sentenceActionLabel: "安排下一件事 →",
    sentencePattern: { prefix: "I", suffix: "日常动作" },
    dialogDescription: "告诉 Lumi 你早晨会做什么",
    quickReplies: ["I get up.", "I eat breakfast."],
    acceptedAnswers: ["get up", "wash", "brush", "breakfast", "go to school", "morning"],
    completionTitle: "美好早晨准备完成！",
    completionMessage: "你已经能用英语介绍自己的早晨了。",
    rewardName: "时间小管家",
  },
};

const fallback = presentations.lesson_05_food;

export function getCoursePresentation(sectionId: string): CoursePresentation {
  return presentations[sectionId] ?? fallback;
}
