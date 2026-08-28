"use dom";

import "./student-ui.css";
import "./learning-components.css";
import "./reference-app.css";

import { FormEvent, useEffect, useState } from "react";
import { activityCatalog, Button, Card, FloatingDecorations, LessonActivityView, LessonComplete, LessonCourseCard, LumiMascot, PageHeader, PhoneShell, Pill, ProgressBar, SectionTitle, StatusBar, StudentPage, type StudentTab, type Tone } from "./components";
import { COURSE_INTRO, COURSE_TITLE, LESSONS } from "../data/mock";

type EntryScreen = "login" | "role";
type Screen = EntryScreen | StudentTab;

type CourseBook = {
  title: string;
  englishTitle: string;
  grade: string;
  series: "主题英语" | "自然拼读" | "绘本口语";
  currentUnit: string;
  progress: number;
  cover: number;
};

const courseBooks: CourseBook[] = [
  { title: "奇妙小镇冒险", englishTitle: "Wonderful Town", grade: "小学一年级", series: "主题英语", currentUnit: "Unit 4 · 水果商店", progress: 42, cover: 0 },
  { title: "彩虹生活岛", englishTitle: "Rainbow Island", grade: "小学一年级", series: "主题英语", currentUnit: "Unit 2 · 我的家", progress: 18, cover: 1 },
  { title: "快乐校园日记", englishTitle: "Happy School", grade: "小学一年级", series: "绘本口语", currentUnit: "Unit 1 · 新朋友", progress: 8, cover: 2 },
  { title: "字母森林", englishTitle: "Alphabet Forest", grade: "小学一年级", series: "自然拼读", currentUnit: "Unit 3 · ABC树屋", progress: 35, cover: 3 },
  { title: "发音小火车", englishTitle: "Phonics Express", grade: "小学二年级", series: "自然拼读", currentUnit: "Unit 5 · sh与ch", progress: 56, cover: 4 },
  { title: "单词魔法屋", englishTitle: "Word Workshop", grade: "小学三年级", series: "自然拼读", currentUnit: "Unit 2 · 魔法拼写", progress: 20, cover: 5 },
  { title: "小熊环游记", englishTitle: "Bear Goes Around", grade: "小学四年级", series: "绘本口语", currentUnit: "Unit 6 · 山谷露营", progress: 68, cover: 6 },
  { title: "海底故事会", englishTitle: "Ocean Stories", grade: "幼儿园中班", series: "绘本口语", currentUnit: "Unit 1 · 蓝色朋友", progress: 12, cover: 7 },
];

const adventureUnits = [
  { number: 1, title: "你好，小镇！", english: "Hello, Town!", meta: "问候与自我介绍", progress: "6/6", icon: "👋", status: "done" as const },
  { number: 2, title: "温暖的家", english: "My Cozy Home", meta: "家庭成员", progress: "6/6", icon: "🏠", status: "done" as const },
  { number: 3, title: "快乐学校", english: "Happy School", meta: "文具与课堂用语", progress: "6/6", icon: "🎒", status: "done" as const },
  { number: 4, title: "水果商店", english: "Fruit Market", meta: "水果、颜色与数量", progress: "3/8", icon: "🍎", status: "current" as const },
  { number: 5, title: "动物公园", english: "Animal Park", meta: "动物与动作", progress: "0/7", icon: "🐼", status: "locked" as const },
  { number: 6, title: "美味餐厅", english: "Tasty Cafe", meta: "食物与简单点餐", progress: "0/8", icon: "🥞", status: "locked" as const },
  { number: 7, title: "星光派对", english: "Starlight Party", meta: "综合复习与成果展示", progress: "0/10", icon: "🌟", status: "locked" as const },
];

const adventureRoutePoints = [
  { x: 35, y: 15.5 },
  { x: 65, y: 29.2 },
  { x: 36, y: 37.5 },
  { x: 67.5, y: 49.1 },
  { x: 34, y: 61 },
  { x: 69.5, y: 72.8 },
  { x: 58, y: 92.3 },
] as const;

function BookCover({ book, compact = false }: { book: CourseBook; compact?: boolean }) {
  return <div className={`book-cover-art cover-${book.cover}${compact ? " compact" : ""}`} role="img" aria-label={`${book.title}绘本封面`}><span className="book-lumi-mark">LUMI</span></div>;
}

function LoginPage({ onNext }: { onNext: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="stage"><PhoneShell label="登录页面" className="auth-page"><FloatingDecorations /><StatusBar />
      <header className="brand-lockup"><div className="brand-mascot"><span className="brand-halo" aria-hidden="true" /><LumiMascot size="large" /></div><span className="eyebrow">HELLO, LITTLE STAR!</span><div className="brand-name">LUMI</div><p>和小熊一起，开心学英语</p></header>
      <form className="login-form" onSubmit={(event) => { event.preventDefault(); onNext(); }}>
        <p className="helper-bubble">请家长或老师帮助小朋友登录哦</p>
        <label>学习账号<span className="field-wrap"><b aria-hidden="true">小</b><input defaultValue="lumi_student" aria-label="学习账号" /></span></label>
        <label>登录密码<span className="field-wrap password-field"><b aria-hidden="true">钥</b><input type={showPassword ? "text" : "password"} defaultValue="123456" aria-label="登录密码" /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "藏起来" : "看一眼"}</button></span></label>
        <Button className="full-button" type="submit">出发学习 <b>→</b></Button>
      </form>
      <button className="text-button" type="button">忘记密码 · 请联系老师</button><p className="privacy-note"><span>☁</span> 未成年人请在家长或教师指导下使用</p>
    </PhoneShell></main>
  );
}

function RolePage({ onEnter, onBack }: { onEnter: () => void; onBack: () => void }) {
  return (
    <main className="stage"><PhoneShell label="身份选择页面" className="role-page"><FloatingDecorations /><StatusBar />
      <header className="identity-hero"><div><span className="eyebrow">WHO ARE YOU?</span><h1>你是谁呀？</h1><p>选择身份，Lumi 带你去对应的小天地</p></div><LumiMascot size="small" /></header>
      <div className="role-list">
        <button className="role-card student-role" type="button" onClick={onEnter}><span className="role-icon lavender">学</span><span><strong>我是小学生</strong><small>课程、AI伙伴、作业与成长</small></span><em>进入 <b>→</b></em></button>
        <button className="role-card disabled" type="button" disabled><span className="role-icon sky">师</span><span><strong>我是老师</strong><small>教师端本期暂不制作</small></span><em>暂未开放</em></button>
        <button className="role-card disabled" type="button" disabled><span className="role-icon peach">家</span><span><strong>我是家长</strong><small>家长端本期暂不制作</small></span><em>暂未开放</em></button>
      </div>
      <div className="role-actions"><Button onClick={onEnter}>以学生身份进入</Button><Button variant="secondary" onClick={onBack}>返回登录</Button></div>
    </PhoneShell></main>
  );
}

const checkInDemoToday = { year: 2026, month: 7, day: 27 };

function isDemoCheckedDay(month: number, day: number, hasCheckedIn: boolean) {
  if (month > checkInDemoToday.month || month === checkInDemoToday.month && day > checkInDemoToday.day) return false;
  if (month === checkInDemoToday.month && day === checkInDemoToday.day) return hasCheckedIn;
  if (month === checkInDemoToday.month && day >= checkInDemoToday.day - 12) return true;
  return (day + month * 2) % 5 !== 0 && (day + month) % 7 !== 0;
}

function CheckInCalendar({ onNavigate, onBack, checkInDays, hasCheckedIn, onCheckIn }: { onNavigate: (tab: StudentTab) => void; onBack: () => void; checkInDays: number; hasCheckedIn: boolean; onCheckIn: () => void }) {
  const [month, setMonth] = useState(checkInDemoToday.month);
  const [showSuccess, setShowSuccess] = useState(false);
  const daysInMonth = new Date(checkInDemoToday.year, month + 1, 0).getDate();
  const firstWeekday = new Date(checkInDemoToday.year, month, 1).getDay();
  const leadingEmpty = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const cells: Array<number | null> = [...Array.from({ length: leadingEmpty }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const isCurrentMonth = month === checkInDemoToday.month;
  const checkedCount = Array.from({ length: daysInMonth }, (_, index) => index + 1).filter((day) => isDemoCheckedDay(month, day, hasCheckedIn)).length;
  const handleTodayCheckIn = () => {
    if (hasCheckedIn) return;
    onCheckIn();
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 1800);
  };
  return (
    <StudentPage active="home" onNavigate={onNavigate} label="签到日历页面">
      <PageHeader eyebrow="DAILY CHECK-IN" title="签到日历" subtitle="每天来和 Lumi 打个招呼" onBack={onBack} trailing={<Pill tone="yellow">🔥 {checkInDays}天</Pill>} />
      <Card className={hasCheckedIn ? "checkin-calendar-hero signed" : "checkin-calendar-hero"}>
        <span className="checkin-big-fire">🔥</span><div><span>连续签到</span><strong>{checkInDays}<small>天</small></strong><p>{hasCheckedIn ? "今天已经留下小火苗啦！" : "今天的小火苗还在等你点亮"}</p></div><LumiMascot size="small" mood={hasCheckedIn ? "happy" : "curious"} />
      </Card>
      <section className="month-controller" aria-label="切换签到月份">
        <div className="month-switch-row"><button type="button" disabled={month === 0} onClick={() => setMonth((value) => Math.max(0, value - 1))} aria-label="前一个月">‹</button><div><span>{checkInDemoToday.year}年</span><strong>{month + 1}月</strong></div><button type="button" disabled={month === 11} onClick={() => setMonth((value) => Math.min(11, value + 1))} aria-label="后一个月">›</button></div>
        <input type="range" min="1" max="12" value={month + 1} onChange={(event) => setMonth(Number(event.target.value) - 1)} aria-label="选择月份，1月至12月" />
        <div className="month-range-labels"><span>1月</span><span>6月</span><span>12月</span></div>
      </section>
      <Card className="checkin-calendar-card">
        <div className="calendar-heading"><div><span>MONTHLY RECORD</span><strong>{month + 1}月签到记录</strong></div><Pill tone="mint">已签到 {checkedCount} 天</Pill></div>
        <div className="calendar-weekdays" aria-hidden="true">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-days">{cells.map((day, index) => {
          if (!day) return <span className="calendar-empty" key={`empty-${index}`} />;
          const checked = isDemoCheckedDay(month, day, hasCheckedIn);
          const today = isCurrentMonth && day === checkInDemoToday.day;
          const past = month < checkInDemoToday.month || isCurrentMonth && day < checkInDemoToday.day;
          const future = month > checkInDemoToday.month || isCurrentMonth && day > checkInDemoToday.day;
          return <span className={`calendar-day${checked ? " checked" : past ? " missed" : future ? " future" : ""}${today ? " today" : ""}`} key={day} aria-label={`${month + 1}月${day}日${checked ? "已签到" : past ? "未签到" : today ? "今天待签到" : ""}`}><b>{day}</b>{checked && <i>🔥</i>}{today && <small>今天</small>}</span>;
        })}</div>
      </Card>
      <div className="calendar-legend"><span><i className="checked" />已签到</span><span><i className="missed" />未签到</span><span><i className="future" />未来日期</span></div>
      <div className="checkin-calendar-action">{isCurrentMonth ? <Button disabled={hasCheckedIn} onClick={handleTodayCheckIn}>{hasCheckedIn ? "✓ 今天已签到" : "🔥 点亮今天的小火苗"}</Button> : <Button variant="secondary" onClick={() => setMonth(checkInDemoToday.month)}>回到本月签到</Button>}{showSuccess && <span role="status">签到成功，连续 {checkInDays} 天！</span>}</div>
    </StudentPage>
  );
}

function CourseLibrary({ onNavigate, onBack }: { onNavigate: (tab: StudentTab) => void; onBack: () => void }) {
  const grades = ["幼儿园小班", "幼儿园中班", "幼儿园大班", "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级"];
  const series = ["全部系列", "主题英语", "自然拼读", "绘本口语"] as const;
  const [selectedGrade, setSelectedGrade] = useState("小学一年级");
  const [selectedSeries, setSelectedSeries] = useState<(typeof series)[number]>("全部系列");
  const gradeBooks = courseBooks.filter((book) => book.grade === selectedGrade);
  const visibleBooks = gradeBooks.filter((book) => selectedSeries === "全部系列" || book.series === selectedSeries);
  return (
    <StudentPage active="home" onNavigate={onNavigate} label="全部教材页面">
      <PageHeader eyebrow="COURSE LIBRARY" title="全部教材" subtitle="挑一本喜欢的绘本，开始今天的英语冒险" onBack={onBack} trailing={<Pill tone="violet">8 本</Pill>} />
      <section className="library-filter-block" aria-label="教材筛选">
        <div className="library-filter-heading"><span>选择年级</span><small>可以浏览全部年级</small></div>
        <div className="grade-chip-scroll">{grades.map((grade) => <button className={selectedGrade === grade ? "selected" : ""} type="button" key={grade} onClick={() => setSelectedGrade(grade)}>{grade}</button>)}</div>
        <div className="series-tabs" role="tablist" aria-label="教材系列">{series.map((item) => <button role="tab" aria-selected={selectedSeries === item} className={selectedSeries === item ? "selected" : ""} type="button" key={item} onClick={() => setSelectedSeries(item)}>{item}</button>)}</div>
      </section>
      <div className="library-result-heading"><div><span>{selectedGrade}</span><strong>{selectedSeries}</strong></div><small>{visibleBooks.length} 本教材</small></div>
      {visibleBooks.length > 0 ? <div className="book-library-grid">{visibleBooks.map((book) => <button className="library-book-card" type="button" key={book.title} onClick={() => onNavigate("learn")}><BookCover book={book} /><span className="library-book-copy"><small>{book.englishTitle}</small><strong>{book.title}</strong><em>{book.grade} · {book.series}</em><span><i style={{ width: `${book.progress}%` }} /></span><b>{book.progress > 0 ? `已学习 ${book.progress}%` : "还未开始"}</b></span></button>)}</div> : <Card className="library-empty"><span>📚</span><strong>这个分类正在准备新教材</strong><p>先去看看其他年级或教材系列吧</p></Card>}
    </StudentPage>
  );
}

function HomePage({ onNavigate, checkInDays, hasCheckedIn, onCheckIn }: { onNavigate: (tab: StudentTab) => void; checkInDays: number; hasCheckedIn: boolean; onCheckIn: () => void }) {
  const [showCheckInCalendar, setShowCheckInCalendar] = useState(false);
  const [showCourseLibrary, setShowCourseLibrary] = useState(false);
  if (showCheckInCalendar) return <CheckInCalendar onNavigate={onNavigate} onBack={() => setShowCheckInCalendar(false)} checkInDays={checkInDays} hasCheckedIn={hasCheckedIn} onCheckIn={onCheckIn} />;
  if (showCourseLibrary) return <CourseLibrary onNavigate={onNavigate} onBack={() => setShowCourseLibrary(false)} />;
  const homeBooks = courseBooks.filter((book) => book.grade === "小学一年级");
  return (
    <StudentPage active="home" onNavigate={onNavigate} label="学生首页">
      <header className="student-header"><div className="avatar-tile"><LumiMascot size="small" /></div><div><p>GOOD MORNING!</p><h1>早上好，陈小鹿</h1></div><div className="checkin-wrap"><button className={hasCheckedIn ? "checkin-button checked" : "checkin-button"} type="button" onClick={() => setShowCheckInCalendar(true)} aria-label={`打开签到日历，连续 ${checkInDays} 天`}><span>🔥</span><strong>{checkInDays}</strong><small>天</small></button></div></header>
      <section className="welcome-card"><span className="welcome-star one">★</span><span className="welcome-star two">✦</span><div className="welcome-copy"><span className="tiny-label">TODAY&apos;S ADVENTURE</span><h2>今天也要勇敢<br />开口说英语！</h2><button type="button" onClick={() => onNavigate("learn")}>继续学习 <b>→</b></button></div><div className="mascot-spot"><LumiMascot size="large" /><span className="speech-dot">Hi!</span></div></section>
      <Card className="progress-strip today-summary-card"><div className="progress-ring"><strong>3</strong><span>/5</span></div><div><span className="today-summary-label">今日任务</span><strong>还剩 2 项小挑战</strong><p>预计 14 分钟 · 完成就能打开星星宝箱</p><ProgressBar value={60} tone="mint" /></div><button className="today-continue-button" type="button" onClick={() => onNavigate("learn")}>继续任务 <b>›</b></button></Card>
      <SectionTitle eyebrow="COURSE RESOURCES" title="甲方课程资源" action="全部教材 →" onAction={() => setShowCourseLibrary(true)} />
      <div className="home-course-scroller" aria-label="小学一年级教材">{homeBooks.map((book, index) => <article className="home-course-card" key={book.title}><BookCover book={book} compact /><div className="home-course-copy"><span>{index === 0 ? "当前主教材" : book.series}</span><h3>{book.title}</h3><small>{book.grade} · {book.currentUnit}</small><div className="home-book-progress"><div><i style={{ width: `${book.progress}%` }} /></div><b>{book.progress}%</b></div><button type="button" onClick={() => onNavigate("learn")}>{index === 0 ? "继续学习" : "打开教材"}<b>→</b></button></div></article>)}</div>
      <div className="course-scroll-hint" aria-hidden="true"><span className="active" /><span /><span /> 左右滑动查看更多</div>
    </StudentPage>
  );
}

function LearnPage({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [view, setView] = useState<"home" | "catalog" | "player" | "complete">("home");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});

  const section = LESSONS[Math.min(sectionIndex, LESSONS.length - 1)];
  const sectionTitle = section.title.replace(/^第\d+节[:：]?/, "").trim();
  const lessonPackage = { id: section.id, title: sectionTitle, intro: COURSE_INTRO, activities: section.activities };

  useEffect(() => {
    document.querySelector<HTMLElement>(".page-scroll-content")?.scrollTo({ top: 0 });
  }, [view, sectionIndex]);

  const startAt = (index = 0, nextSection = sectionIndex) => {
    setSectionIndex(nextSection);
    setStep(index);
    setSessionStart(index);
    setResults({});
    setView("player");
  };
  const finishStep = () => {
    setResults((items) => ({ ...items, [step]: items[step] ?? true }));
    if (step >= section.activities.length - 1) setView("complete");
    else setStep((value) => value + 1);
  };
  const completedCount = Object.keys(results).length;
  const passedCount = Object.values(results).filter(Boolean).length;

  if (view === "complete") {
    return <StudentPage active="learn" onNavigate={onNavigate} label="课程完成页面"><LessonComplete correct={passedCount} total={Math.max(1, completedCount)} onRestart={() => startAt(sessionStart)} onHome={() => setView("home")} /></StudentPage>;
  }

  if (view === "catalog") {
    return (
      <StudentPage active="learn" onNavigate={onNavigate} label="学习课程目录页面">
        <PageHeader eyebrow="TODAY&apos;S ADVENTURE" title={sectionTitle} subtitle={`${COURSE_TITLE} · 和 Lumi 一路学到会`} onBack={() => setView("home")} trailing={<Pill tone="yellow">⭐ +{section.activities.length}</Pill>} />
        <LessonCourseCard lesson={lessonPackage} onStart={() => startAt(0)} />
        <SectionTitle eyebrow="ADVENTURE ROUTE" title="今天的冒险路线" />
        <div className="course-schema-list">{section.activities.map((activity, index) => {
          const meta = activityCatalog.find((item) => item.type === activity.type) ?? activityCatalog[0];
          const detail = activity.type === "word" ? `认识 ${activity.word}` : activity.type === "sentence" ? `学会说：${activity.sentence}` : activity.type === "recall" ? activity.mode === "audio_to_text" ? "听声音，找到藏起来的句子" : activity.mode === "fill_blank" ? "补好水果店的句子招牌" : "想一想，把苹果卡片找出来" : activity.type === "pronunciation" ? `勇敢读出 ${activity.content}` : `在${activity.scene}完成英语对话`;
          return <button className="course-schema-row" type="button" key={`${activity.type}-${index}`} onClick={() => startAt(index)}><span>{meta.icon}</span><div><strong>{index + 1}. {meta.studentTitle}</strong><small>{detail}</small></div><b>出发 ›</b></button>;
        })}</div>
        <Card className="learning-note" tone="sky"><span>🦌</span><div><strong>Lumi 会一直陪着你</strong><p>每完成一个小挑战，就会离水果店和星星宝箱更近一点。</p></div></Card>
      </StudentPage>
    );
  }

  if (view === "player") {
    const activity = section.activities[step];
    const meta = activityCatalog.find((item) => item.type === activity.type) ?? activityCatalog[0];
    return (
      <StudentPage active="learn" onNavigate={onNavigate} label={`${meta.studentTitle}页面`} hideNav>
        <header className="lesson-focus-header">
          <button type="button" onClick={() => setView("catalog")} aria-label="退出当前课程">×</button>
          <div><strong>{sectionTitle}</strong><span>{meta.studentTitle}</span></div>
          <b className="lesson-score">★ 126</b>
        </header>
        <LessonActivityView
          activity={activity}
          step={step}
          total={section.activities.length}
          onCompleted={(correct) => setResults((items) => ({ ...items, [step]: correct }))}
          onNext={finishStep}
          onPrevious={() => setStep((value) => Math.max(sessionStart, value - 1))}
          canPrevious={step > sessionStart}
        />
      </StudentPage>
    );
  }

  return (
    <StudentPage active="learn" onNavigate={onNavigate} label="英语学习页面">
      <PageHeader eyebrow="MY STORY JOURNEY" title="学习冒险" subtitle={`沿着小镇路线，完成 ${LESSONS.length} 个英语小节`} trailing={<Pill tone="yellow">⭐ 126</Pill>} />
      <Card className="current-book-card">
        <BookCover book={courseBooks[0]} compact />
        <div className="current-book-copy"><span>当前课程 · 英语启蒙</span><h2>{COURSE_TITLE}</h2><p>{COURSE_INTRO}</p><div><ProgressBar value={10} tone="violet" /><b>10%</b></div></div>
        <button type="button" className="book-directory-button" onClick={() => document.getElementById("adventure-map")?.scrollIntoView({ behavior: "smooth", block: "start" })}>课程目录 ↓</button>
      </Card>
      <SectionTitle eyebrow="WONDERFUL TOWN" title="7 单元冒险地图" />
      <div className="adventure-map-stage" id="adventure-map" aria-label="奇妙小镇7单元冒险地图">
        {adventureUnits.map((unit, index) => {
          const point = adventureRoutePoints[index];
          return <div className={`adventure-stop status-${unit.status}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} key={unit.number}><button type="button" className="adventure-node" disabled={unit.status === "locked"} onClick={() => { if (unit.status !== "locked") { setSectionIndex(index); setView("catalog"); } }} aria-label={`Unit ${unit.number} ${unit.title}，${unit.status === "done" ? "已完成" : unit.status === "current" ? "正在学习" : "尚未解锁"}`}><span>{unit.number}</span></button></div>;
        })}
      </div>
      <SectionTitle eyebrow="ALL LESSONS" title="全部 10 个英语小节" />
      <div className="course-schema-list">{LESSONS.map((lesson, index) => <button className="course-schema-row" type="button" key={lesson.id} onClick={() => { setSectionIndex(index); setView("catalog"); }}><span>{index + 1}</span><div><strong>{lesson.title}</strong><small>{lesson.activities.length} 个互动学习挑战</small></div><b>出发 ›</b></button>)}</div>
    </StudentPage>
  );
}

function AiPage({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState([{ role: "lumi", text: "Hi，小鹿！今天想聊动物、学校，还是听一个英语故事？", translation: "嗨，小鹿！选择一个你喜欢的话题吧。" }]);
  const sendMessage = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setMessages((items) => [...items, { role: "student", text: value, translation: "" }, { role: "lumi", text: "Great choice! Let’s say it together: I like pandas!", translation: "很棒！我们一起说：我喜欢熊猫！" }]);
    setInput("");
  };
  const submit = (event: FormEvent) => { event.preventDefault(); sendMessage(input); };
  return (
    <StudentPage active="ai" onNavigate={onNavigate} label="AI英语伙伴页面">
      <div className="ai-page-layout"><PageHeader eyebrow="LUMI AI BUDDY" title="AI 英语伙伴" subtitle="安全陪伴模式已开启" trailing={<Pill tone="mint">● 在线</Pill>} />
        <Card className="ai-companion-card" tone="violet"><LumiMascot size="medium" /><div><strong>Lumi 在这里</strong><p>可以说中文，也可以试试英语。说错没关系，我会给你小提示。</p></div><span>✨</span></Card>
        <div className="chat-list" aria-live="polite">{messages.map((message, index) => <div className={`chat-row ${message.role}`} key={`${message.role}-${index}`}>{message.role === "lumi" && <span className="mini-ai">AI</span>}<div className="chat-bubble"><strong>{message.text}</strong>{message.translation && <small>{message.translation}</small>}{message.role === "lumi" && <button type="button" aria-label="播放回答">▶ 听一听</button>}</div></div>)}</div>
        <div className="quick-prompts" aria-label="快捷提问">{["我想聊动物", "讲个小故事", "陪我练口语"].map((text) => <button key={text} type="button" onClick={() => sendMessage(text)}>{text}</button>)}</div>
        <p className="safety-caption">Lumi 只回答适合儿童的英语学习内容，重要问题请询问老师或家长。</p>
        <form className="chat-composer" onSubmit={submit}><button className={listening ? "voice-button listening" : "voice-button"} type="button" aria-label="语音输入" onClick={() => setListening((value) => !value)}>{listening ? "◼" : "🎙"}</button><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={listening ? "正在听你说…" : "输入想问的问题"} aria-label="向Lumi提问" /><button className="send-button" type="submit" aria-label="发送消息">↑</button></form>
      </div>
    </StudentPage>
  );
}

const homeworkItems = [
  { title: "Unit 3 书面作业", detail: "拍照上传练习册第 12 页", status: "待完成", tone: "yellow" as Tone, icon: "拍", action: "去完成" },
  { title: "At the zoo 口语", detail: "朗读 3 句话，预计 5 分钟", status: "待完成", tone: "pink" as Tone, icon: "说", action: "去录音" },
  { title: "My family 小作文", detail: "AI 正在识别和批改", status: "批改中", tone: "sky" as Tone, icon: "文", action: "查看进度" },
  { title: "单词听写 · 动物", detail: "得分 92，订正 1 题", status: "已完成", tone: "mint" as Tone, icon: "✓", action: "看结果" },
];

function HomeworkPage({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [filter, setFilter] = useState("待完成");
  const visible = homeworkItems.filter((item) => item.status === filter);
  return (
    <StudentPage active="homework" onNavigate={onNavigate} label="作业中心页面">
      <PageHeader eyebrow="HOMEWORK" title="作业中心" subtitle="先完成一点，再开心玩耍" trailing={<Pill tone="pink">2项待完成</Pill>} />
      <Card className="homework-summary"><div><span>今日作业</span><strong>2</strong><small>项待完成</small></div><div><span>本周正确率</span><strong>89%</strong><small>比上周 +6%</small></div><div className="homework-mascot"><LumiMascot size="small" /></div></Card>
      <div className="segmented-tabs" role="tablist">{["待完成", "批改中", "已完成"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={filter === tab} className={filter === tab ? "active" : ""} onClick={() => setFilter(tab)}>{tab}<span>{homeworkItems.filter((item) => item.status === tab).length}</span></button>)}</div>
      <div className="homework-list">{visible.map((item) => <Card className="homework-card" key={item.title}><span className={`homework-icon tone-${item.tone}`}>{item.icon}</span><div><Pill tone={item.tone}>{item.status}</Pill><h3>{item.title}</h3><p>{item.detail}</p></div><Button variant={item.status === "待完成" ? "primary" : "secondary"}>{item.action}</Button></Card>)}</div>
      {filter === "待完成" && <Card className="upload-tip" tone="sky"><span>📷</span><div><strong>拍照小技巧</strong><p>把作业纸放平、光线亮一点，四个角都拍进去。</p></div></Card>}
    </StudentPage>
  );
}

function GrowthPage({ onNavigate, onLogout }: { onNavigate: (tab: StudentTab) => void; onLogout: () => void }) {
  const skills = [{ name: "词汇", value: 78, tone: "violet" as Tone }, { name: "口语", value: 64, tone: "mint" as Tone }, { name: "阅读", value: 72, tone: "sky" as Tone }, { name: "写作", value: 55, tone: "pink" as Tone }];
  return (
    <StudentPage active="growth" onNavigate={onNavigate} label="我的成长页面">
      <PageHeader eyebrow="MY GROWTH" title="我的成长" subtitle="每一点进步都值得被看见" trailing={<button className="settings-button" type="button" aria-label="设置">⚙</button>} />
      <Card className="profile-card"><div className="profile-avatar"><LumiMascot size="small" /></div><div><h2>陈小鹿</h2><p>阳光小学 · 三年级2班</p><Pill tone="yellow">Level 6 · 小小探险家</Pill></div></Card>
      <div className="growth-stats"><Card><span>本周学习</span><strong>4<small>天</small></strong><p>按自己的节奏前进</p></Card><Card><span>本周星星</span><strong>48<small>颗</small></strong><p>每颗都记录一次努力</p></Card></div>
      <SectionTitle eyebrow="SKILLS" title="能力成长" action="学习周报 →" />
      <Card className="skill-card">{skills.map((skill) => <div className="skill-row" key={skill.name}><span>{skill.name}</span><ProgressBar value={skill.value} tone={skill.tone} /><strong>{skill.value}%</strong></div>)}</Card>
      <SectionTitle eyebrow="MY PLAN" title="我的专属学习计划" />
      <Card className="plan-card" tone="violet"><div className="plan-top"><div><Pill tone="violet">本周计划</Pill><h3>已完成 4 / 7 个任务</h3></div><strong>57%</strong></div><ProgressBar value={57} tone="violet" /><p>今天建议：复习 12 个动物单词，再练习 8 分钟口语。</p><Button onClick={() => onNavigate("learn")}>开始今日计划</Button></Card>
      <Card className="wrongbook-card"><span>📘</span><div><strong>我的错题本</strong><p>共 18 题，今天建议复习 5 题</p></div><button type="button">开始复习 ›</button></Card>
      <button className="logout-button" type="button" onClick={onLogout}>退出演示账号</button>
    </StudentPage>
  );
}

export default function ReferenceApp({ dom: _dom }: { dom?: import("expo/dom").DOMProps }) {
  const [screen, setScreen] = useState<Screen>("login");
  const [checkInDays, setCheckInDays] = useState(12);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const checkIn = () => { if (!hasCheckedIn) { setCheckInDays((days) => days + 1); setHasCheckedIn(true); } };
  if (screen === "login") return <LoginPage onNext={() => setScreen("role")} />;
  if (screen === "role") return <RolePage onEnter={() => setScreen("home")} onBack={() => setScreen("login")} />;
  const navigate = (tab: StudentTab) => setScreen(tab);
  if (screen === "learn") return <LearnPage onNavigate={navigate} />;
  if (screen === "ai") return <AiPage onNavigate={navigate} />;
  if (screen === "homework") return <HomeworkPage onNavigate={navigate} />;
  if (screen === "growth") return <GrowthPage onNavigate={navigate} onLogout={() => setScreen("login")} />;
  return <HomePage onNavigate={navigate} checkInDays={checkInDays} hasCheckedIn={hasCheckedIn} onCheckIn={checkIn} />;
}
