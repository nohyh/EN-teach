"use dom";

import "../components/ui/student-ui.css";
import "../components/lesson/lesson-components.css";
import "./student-app.css";
import "../styles/playful-learning-theme.css";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { activityCatalog, LessonComplete, LessonRenderer, SpeechRuntimeProvider } from "../components/lesson/LessonRenderer";
import { Button, Card, DemoToast, FloatingDecorations, LumiMascot, PageHeader, PhoneShell, Pill, StudentPage, type StudentTab } from "../components/ui/StudentUI";
import { LESSONS } from "../data/mock";
import type { Activity } from "../types/lesson";
import type { SpeechRuntime } from "../types/speech";
import type { AuthUser } from "../services/auth";
import type { CloudAssignment, CloudProgress, CloudWrongItem, GrowthSummary, LearningEventInput, PointsAccount, PublishedCourse, StoreItem } from "../services/api";
import lumiLogo from "../../assets/lumi-logo-plain-shirt.png";
import lumiBookCovers from "../../public/course-art/lumi-book-covers-v1.png";
import wonderTownMap from "../../public/course-art/wonder-town-map-v1.png";
import { getCoursePresentation } from "../data/course-presentation";
import { lessonProgressKey, useDemoState, type DemoState, type MascotSkin } from "../stores/demo-state";

type EntryScreen = "login" | "role";
type Screen = EntryScreen | StudentTab;
type DemoController = ReturnType<typeof useDemoState>;

const mascotSkins: Array<{ id: MascotSkin; name: string; placeholder: string }> = [
  { id: "honey", name: "蜂蜜", placeholder: "🐻" },
  { id: "mint", name: "薄荷", placeholder: "🌿" },
  { id: "berry", name: "莓果", placeholder: "🍓" },
  { id: "midnight", name: "星夜", placeholder: "🌙" },
];

type CourseBook = {
  title: string;
  grade: string;
  series: "主题英语" | "自然拼读" | "绘本口语";
  progress: number;
  cover: number;
};

const courseBooks: CourseBook[] = [
  { title: "奇妙小镇冒险", grade: "小学一年级", series: "主题英语", progress: 42, cover: 0 },
  { title: "彩虹生活岛", grade: "小学一年级", series: "主题英语", progress: 18, cover: 1 },
  { title: "快乐校园日记", grade: "小学一年级", series: "绘本口语", progress: 8, cover: 2 },
  { title: "字母森林", grade: "小学一年级", series: "自然拼读", progress: 35, cover: 3 },
];

type MapLessonNode = {
  number: number;
  packageIndex: number;
  title: string;
  meta: string;
  icon: string;
};

const townLessonNodes: MapLessonNode[] = [
  { number: 1, packageIndex: 0, title: "你好，小镇！", meta: "问候与自我介绍", icon: "👋" },
  { number: 2, packageIndex: 3, title: "温暖的家", meta: "家庭成员", icon: "🏠" },
  { number: 3, packageIndex: 6, title: "快乐学校", meta: "文具与课堂用语", icon: "🎒" },
  { number: 4, packageIndex: 4, title: "水果商店", meta: "水果、颜色与数量", icon: "🍎" },
  { number: 5, packageIndex: 5, title: "动物公园", meta: "动物与动作", icon: "🐼" },
  { number: 6, packageIndex: 4, title: "美味餐厅", meta: "食物与简单点餐", icon: "🥞" },
  { number: 7, packageIndex: 9, title: "星光派对", meta: "综合复习与成果展示", icon: "🌟" },
];

const courseAdventureMaps: Array<{ bookIndex: number; theme: string; icon: string; lessons: MapLessonNode[] }> = [
  { bookIndex: 0, theme: "town", icon: "🏰", lessons: townLessonNodes },
  { bookIndex: 1, theme: "island", icon: "🌈", lessons: [
    { number: 1, packageIndex: 1, title: "彩虹码头", meta: "颜色与问候", icon: "⛵" },
    { number: 2, packageIndex: 3, title: "我的小屋", meta: "家庭成员与房间", icon: "🏡" },
    { number: 3, packageIndex: 8, title: "云朵花园", meta: "天气与自然", icon: "☁️" },
    { number: 4, packageIndex: 4, title: "海风集市", meta: "食物与数量", icon: "🍉" },
    { number: 5, packageIndex: 6, title: "贝壳学校", meta: "校园与朋友", icon: "🐚" },
    { number: 6, packageIndex: 9, title: "灯塔故事", meta: "句子与表达", icon: "🗼" },
    { number: 7, packageIndex: 7, title: "彩虹庆典", meta: "综合复习", icon: "🎈" },
  ] },
  { bookIndex: 2, theme: "school", icon: "🎒", lessons: [
    { number: 1, packageIndex: 0, title: "遇见新朋友", meta: "自我介绍", icon: "👋" },
    { number: 2, packageIndex: 6, title: "我的教室", meta: "教室与文具", icon: "✏️" },
    { number: 3, packageIndex: 7, title: "快乐课间", meta: "动作与游戏", icon: "⚽" },
    { number: 4, packageIndex: 4, title: "午餐时间", meta: "食物与喜好", icon: "🥪" },
    { number: 5, packageIndex: 2, title: "音乐教室", meta: "声音与节奏", icon: "🎵" },
    { number: 6, packageIndex: 9, title: "放学以后", meta: "时间与日常", icon: "🚌" },
    { number: 7, packageIndex: 8, title: "校园表演", meta: "成果展示", icon: "🎭" },
  ] },
  { bookIndex: 3, theme: "forest", icon: "🔤", lessons: [
    { number: 1, packageIndex: 0, title: "字母树屋", meta: "A–F 字母音", icon: "🌳" },
    { number: 2, packageIndex: 1, title: "元音小溪", meta: "短元音发音", icon: "💧" },
    { number: 3, packageIndex: 2, title: "拼读山谷", meta: "CVC 单词拼读", icon: "🏕️" },
    { number: 4, packageIndex: 5, title: "声音洞穴", meta: "辅音组合", icon: "🪨" },
    { number: 5, packageIndex: 4, title: "单词花园", meta: "常见单词", icon: "🌻" },
    { number: 6, packageIndex: 8, title: "句子木屋", meta: "简单句阅读", icon: "🛖" },
    { number: 7, packageIndex: 9, title: "森林朗读会", meta: "综合拼读", icon: "📖" },
  ] },
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

function getLessonProgress(node: MapLessonNode, courseIndex: number, lessonIndex: number, demoState: DemoState) {
  const total = LESSONS[node.packageIndex]?.activities.length ?? 0;
  const stored = demoState.lessonProgress[lessonProgressKey(courseIndex, lessonIndex)];
  const previous = lessonIndex > 0
    ? demoState.lessonProgress[lessonProgressKey(courseIndex, lessonIndex - 1)]
    : undefined;
  const status = stored?.completed
    ? "done"
    : stored || lessonIndex === 0 || previous?.completed
      ? "current"
      : "locked";
  const completed = status === "done" ? total : Math.min(stored?.completedActivities ?? 0, total);
  return { completed, label: `${completed}/${total}`, status };
}

function activityPrompt(activity: Activity) {
  if (activity.type === "word") return activity.word;
  if (activity.type === "sentence") return activity.sentence;
  if (activity.type === "recall") return activity.prompt;
  if (activity.type === "pronunciation") return activity.content;
  return activity.opening;
}

function activityAnswer(activity: Activity) {
  if (activity.type === "word") return activity.meaning;
  if (activity.type === "sentence") return activity.meaning;
  if (activity.type === "recall") return activity.answer;
  if (activity.type === "pronunciation") return activity.content;
  return activity.goal;
}

function BookCover({ book, compact = false }: { book: CourseBook; compact?: boolean }) {
  return <div className={`book-cover-art cover-${book.cover}${compact ? " compact" : ""}`} role="img" aria-label={`${book.title}绘本封面`}><img className="book-cover-sprite" src={lumiBookCovers} alt="" aria-hidden="true" draggable={false} /><span className="book-lumi-mark">LUMI</span></div>;
}

function LoginPage({ authReady, onLogin, onNotice }: { authReady: boolean; onLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>; onNotice: (message: string) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authReady || submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    const result = await onLogin(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
    if (!result.ok) setError(result.error || "登录失败，请稍后重试");
    setSubmitting(false);
  };
  return (
    <main className="stage"><PhoneShell label="登录页面" className="auth-page"><FloatingDecorations />
      <header className="brand-lockup"><div className="brand-mascot"><span className="brand-halo" aria-hidden="true" /><LumiMascot size="large" /></div><span className="eyebrow">HELLO, LITTLE STAR!</span><div className="brand-name">LUMI</div><p>和小熊一起，开心学英语</p></header>
      <form className="login-form" onSubmit={handleSubmit}>
        <p className="helper-bubble">请家长或老师帮助小朋友登录哦</p>
        <label>学习账号<span className="field-wrap"><b aria-hidden="true">小</b><input name="username" defaultValue="lumi_student" autoComplete="username" aria-label="学习账号" required /></span></label>
        <label>登录密码<span className="field-wrap password-field"><b aria-hidden="true">钥</b><input name="password" type={showPassword ? "text" : "password"} defaultValue="LumiDemo123!" autoComplete="current-password" aria-label="登录密码" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "藏起来" : "看一眼"}</button></span></label>
        {error && <p className="helper-bubble" role="alert">{error}</p>}
        <Button className="full-button" type="submit" disabled={!authReady || submitting}>{!authReady ? "正在恢复登录…" : submitting ? "正在登录…" : <>出发学习 <b>→</b></>}</Button>
      </form>
      <button className="text-button" type="button" onClick={() => onNotice("演示账号无需重置密码，正式版可由老师统一管理")}>忘记密码 · 请联系老师</button><p className="privacy-note"><span>☁</span> 未成年人请在家长或教师指导下使用</p>
    </PhoneShell></main>
  );
}

function RolePage({ onEnter, onBack }: { onEnter: () => void; onBack: () => void }) {
  return (
    <main className="stage"><PhoneShell label="身份选择页面" className="role-page"><FloatingDecorations />
      <header className="identity-hero"><div><span className="eyebrow">WHO ARE YOU?</span><h1>你是谁呀？</h1><p>选择身份，Lumi 带你去对应的小天地</p></div><LumiMascot size="small" /></header>
      <div className="role-list">
        <button className="role-card student-role" type="button" onClick={onEnter}><span className="role-icon lavender">学</span><span><strong>我是小学生</strong><small>课程、AI伙伴、作业与成长</small></span><em>进入 <b>→</b></em></button>
        <button className="role-card" type="button" onClick={() => { window.location.href = "/content-admin"; }}><span className="role-icon sky">师</span><span><strong>我是老师</strong><small>班级、作业、课程与学习看板</small></span><em>进入 <b>→</b></em></button>
        <button className="role-card" type="button" onClick={() => { window.location.href = "/family"; }}><span className="role-icon peach">家</span><span><strong>我是家长</strong><small>周报、进步点与通知偏好</small></span><em>进入 <b>→</b></em></button>
      </div>
      <div className="role-actions"><Button onClick={onEnter}>以学生身份进入</Button><Button variant="secondary" onClick={onBack}>返回登录</Button></div>
    </PhoneShell></main>
  );
}

const demoNow = new Date();
const checkInDemoToday = { year: demoNow.getFullYear(), month: demoNow.getMonth(), day: demoNow.getDate() };

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

function AdventurePage({ onNavigate, demo, publishedCourses, cloudAssignments, onLearningEvent }: { onNavigate: (tab: StudentTab) => void; demo: DemoController; publishedCourses: PublishedCourse[]; cloudAssignments: CloudAssignment[]; onLearningEvent: (event: LearningEventInput) => Promise<{ ok: boolean }> }) {
  const [view, setView] = useState<"home" | "player" | "complete">("home");
  const [showCheckInCalendar, setShowCheckInCalendar] = useState(false);
  const [showCourseSwitcher, setShowCourseSwitcher] = useState(false);
  const [showMascotPicker, setShowMascotPicker] = useState(false);
  const [pendingLessonIndex, setPendingLessonIndex] = useState<number | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [sessionReward, setSessionReward] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [cloudSelection, setCloudSelection] = useState<{ courseIndex: number; sectionIndex: number } | null>(null);
  const resultsRef = useRef<Record<number, boolean>>({});
  const sessionEventPrefix = useRef(`learn-${Date.now().toString(36)}`);
  const { state: demoState } = demo;
  const { activeCourseIndex, mascotSkin, checkInDays, hasCheckedIn } = demoState;
  const activeCourseMap = courseAdventureMaps[activeCourseIndex] ?? courseAdventureMaps[0];
  const activeBook = courseBooks[activeCourseMap.bookIndex];
  const activeLesson = activeCourseMap.lessons[activeLessonIndex] ?? activeCourseMap.lessons[0];
  const pendingLesson = pendingLessonIndex == null ? null : activeCourseMap.lessons[pendingLessonIndex];
  const pendingLessonProgress = pendingLesson && pendingLessonIndex != null ? getLessonProgress(pendingLesson, activeCourseIndex, pendingLessonIndex, demoState) : null;
  const todayTaskCount = Object.values(demoState.assignmentProgress).filter((progress) => progress < 100).length
    + cloudAssignments.filter((assignment) => assignment.progress.status !== "completed").length;

  const cloudCourse = cloudSelection ? publishedCourses[cloudSelection.courseIndex] : undefined;
  const cloudSection = cloudCourse && cloudSelection ? cloudCourse.content.sections[cloudSelection.sectionIndex] : undefined;
  const section = cloudSection ?? LESSONS[Math.min(sectionIndex, LESSONS.length - 1)];
  const presentation = getCoursePresentation(section.id);
  const activeProgressKey = cloudCourse
    ? `published-${cloudCourse.id}-${cloudCourse.version}-${section.id}`
    : lessonProgressKey(activeCourseIndex, activeLessonIndex);

  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.querySelector<HTMLElement>(".page-scroll-content")?.scrollTo({ top: 0 });
  }, [view, sectionIndex, step]);

  useEffect(() => {
    if (!pendingLesson) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingLessonIndex(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pendingLesson]);

  useEffect(() => {
    if (!showMascotPicker) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMascotPicker(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showMascotPicker]);

  const startAt = (index = 0, nextSection = sectionIndex) => {
    sessionEventPrefix.current = `learn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    setSectionIndex(nextSection);
    setStep(index);
    setSessionStart(index);
    setResults({});
    resultsRef.current = {};
    setSessionReward(0);
    setView("player");
  };
  const recordResult = (correct: boolean) => {
    resultsRef.current = { ...resultsRef.current, [step]: correct };
    setResults(resultsRef.current);
  };
  const finishStep = () => {
    const effectiveResults = {
      ...resultsRef.current,
      [step]: resultsRef.current[step] ?? true,
    };
    resultsRef.current = effectiveResults;
    setResults(effectiveResults);
    const previousProgress = demoState.lessonProgress[activeProgressKey];
    const lastStep = step >= section.activities.length - 1;
    const reward = lastStep && !previousProgress?.completed ? 10 : 0;
    const activity = section.activities[step];
    const correct = effectiveResults[step] ?? true;
    void onLearningEvent({
      idempotency_key: `${sessionEventPrefix.current}:${step}`,
      course_ref: cloudCourse ? `course:${cloudCourse.id}:v${cloudCourse.version}` : `mock:${activeCourseIndex}`,
      course_id: cloudCourse?.id,
      client_progress_key: activeProgressKey,
      section_id: section.id,
      activity_index: step,
      activity_type: activity.type,
      knowledge_key: `${section.id}:${activity.type}:${step}`,
      prompt: activityPrompt(activity),
      correct_answer: activityAnswer(activity),
      correct,
      completed_activities: lastStep ? section.activities.length : step + 1,
      total_activities: section.activities.length,
    });
    demo.patch((current) => ({
      lessonProgress: {
        ...current.lessonProgress,
        [activeProgressKey]: {
          completedActivities: lastStep ? section.activities.length : Math.max(previousProgress?.completedActivities ?? 0, step + 1),
          completed: lastStep,
        },
      },
      stars: current.stars + reward,
    }));
    if (lastStep) {
      setSessionReward(reward);
      setView("complete");
    } else {
      setStep((value) => value + 1);
    }
  };
  const completedCount = Object.keys(results).length;
  const passedCount = Object.values(results).filter(Boolean).length;
  const openLesson = (index: number) => {
    const node = activeCourseMap.lessons[index];
    if (!node) return;
    const lessonProgress = getLessonProgress(node, activeCourseIndex, index, demoState);
    const completedChallenges = lessonProgress.status === "current" ? lessonProgress.completed : 0;
    const nextSection = Math.min(node.packageIndex, LESSONS.length - 1);
    const nextActivities = LESSONS[nextSection]?.activities ?? [];
    const resumeStep = Math.min(completedChallenges, Math.max(0, nextActivities.length - 1));
    setActiveLessonIndex(index);
    setCloudSelection(null);
    startAt(resumeStep, nextSection);
  };
  const openPublishedLesson = (courseIndex: number, nextSectionIndex: number) => {
    const nextCourse = publishedCourses[courseIndex];
    const nextSection = nextCourse?.content.sections[nextSectionIndex];
    if (!nextSection) return;
    setCloudSelection({ courseIndex, sectionIndex: nextSectionIndex });
    startAt(0, 0);
  };
  const switchCourse = (index: number) => {
    demo.patch({ activeCourseIndex: index });
    setActiveLessonIndex(0);
    setPendingLessonIndex(null);
    setShowCourseSwitcher(false);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".page-scroll-content")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  const checkIn = () => {
    if (hasCheckedIn) return;
    demo.patch({ hasCheckedIn: true, checkInDays: checkInDays + 1, stars: demoState.stars + 2 });
  };

  if (showCheckInCalendar) {
    return <CheckInCalendar onNavigate={onNavigate} onBack={() => setShowCheckInCalendar(false)} checkInDays={checkInDays} hasCheckedIn={hasCheckedIn} onCheckIn={checkIn} />;
  }

  if (view === "complete") {
    return <StudentPage active="home" onNavigate={onNavigate} label="课程完成页面"><LessonComplete correct={passedCount} total={Math.max(1, completedCount)} presentation={presentation} reward={sessionReward} onRestart={() => startAt(sessionStart)} onHome={() => setView("home")} /></StudentPage>;
  }

  if (view === "player") {
    const activity = section.activities[step];
    const meta = activityCatalog.find((item) => item.type === activity.type) ?? activityCatalog[0];
    return (
      <StudentPage active="home" onNavigate={onNavigate} label={`${meta.studentTitle}页面`} hideNav>
        <header className="lesson-focus-header">
          <button type="button" onClick={() => setView("home")} aria-label="退出当前课程并返回地图">×</button>
          <div><strong>{cloudCourse ? `${cloudCourse.title} · ${section.title}` : activeLesson.title}</strong><span>{meta.studentTitle}</span></div>
          <b className="lesson-score">★ {demoState.stars}</b>
        </header>
        <LessonRenderer
          activity={activity}
          presentation={presentation}
          step={step}
          total={section.activities.length}
          onCompleted={recordResult}
          onNext={finishStep}
          onPrevious={() => setStep((value) => Math.max(sessionStart, value - 1))}
          canPrevious={step > sessionStart}
        />
      </StudentPage>
    );
  }

  return (
    <StudentPage active="home" onNavigate={onNavigate} label="冒险地图首页">
      <header className="adventure-home-header">
        <div className={`mascot-skin-picker${showMascotPicker ? " open" : ""}`}>
          <button className="adventure-logo" type="button" aria-expanded={showMascotPicker} aria-label="更换 Lumi 吉祥物皮肤" onClick={() => setShowMascotPicker((value) => !value)}><img className="adventure-logo-image" src={lumiLogo} alt="" /></button>
          {showMascotPicker && <section className="mascot-skin-panel" aria-label="选择 Lumi 皮肤">
            <div className="mascot-skin-list" role="listbox">{mascotSkins.map((skin) => <button type="button" role="option" aria-selected={skin.id === mascotSkin} className={skin.id === mascotSkin ? "selected" : ""} key={skin.id} onClick={() => { demo.patch({ mascotSkin: skin.id }); setShowMascotPicker(false); }}><strong>{skin.name}</strong><span className={`mascot-skin-placeholder skin-${skin.id}`}>{skin.placeholder}</span>{skin.id === mascotSkin && <b>✓</b>}</button>)}</div>
          </section>}
        </div>
        <div className="adventure-stats" aria-label="今日学习状态">
          <button className="adventure-stat streak" type="button" onClick={() => setShowCheckInCalendar(true)} aria-label={`连续学习 ${checkInDays} 天，打开签到日历`}><span>🔥</span><strong>{checkInDays}</strong></button>
          <button className="adventure-stat tasks" type="button" onClick={() => onNavigate("homework")} aria-label={`今日还有 ${todayTaskCount} 项作业，打开作业页`}><span>✓</span><strong>{todayTaskCount}</strong></button>
          <div className="adventure-stat stars" aria-label={`拥有 ${demoState.stars} 颗星星`}><span>★</span><strong>{demoState.stars}</strong></div>
        </div>
      </header>

      <section className={`adventure-map-home theme-${activeCourseMap.theme}`}>
        {publishedCourses.length > 0 && <section className="published-course-shelf" aria-label="已发布课程">
          <header><div><span>NEW CONTENT</span><strong>老师新发布的课程</strong></div><em>{publishedCourses.length} 门</em></header>
          {publishedCourses.map((course, courseIndex) => <article key={`${course.id}-${course.version}`}>
            <div><b>{course.title}</b><small>版本 {course.version} · {course.content.sections.length} 节</small></div>
            <div className="published-section-list">{course.content.sections.map((lessonSection, nextSectionIndex) => <button type="button" key={lessonSection.id} onClick={() => openPublishedLesson(courseIndex, nextSectionIndex)}>{lessonSection.title}<span>开始 →</span></button>)}</div>
          </article>)}
        </section>}
        <div className={`map-course-switcher${showCourseSwitcher ? " open" : ""}`}>
          <button className="map-course-trigger" type="button" aria-expanded={showCourseSwitcher} aria-label={`当前章节 ${activeBook.title}，进度 ${activeBook.progress}%，点击切换`} onClick={() => setShowCourseSwitcher((value) => !value)}>
            <span className={`course-world-icon theme-${activeCourseMap.theme}`}>{activeCourseMap.icon}</span>
            <span className="map-course-copy"><strong>{activeBook.title}</strong><small>{activeBook.progress}% · 切换章节</small></span>
            <span className="map-course-chevron" aria-hidden="true">⌄</span>
          </button>
          {showCourseSwitcher && <div className="course-switcher-panel" role="listbox" aria-label="可选课程">{courseAdventureMaps.map((course, index) => {
            const book = courseBooks[course.bookIndex];
            return <button type="button" role="option" aria-selected={index === activeCourseIndex} className={index === activeCourseIndex ? "selected" : ""} key={book.title} onClick={() => switchCourse(index)}><span className={`course-world-icon theme-${course.theme}`}>{course.icon}</span><span><strong>{book.title}</strong><small>{book.grade} · {book.series}</small></span><em>{book.progress}%</em>{index === activeCourseIndex && <b>✓</b>}</button>;
          })}</div>}
        </div>
        <div className="adventure-map-stage" id="adventure-map" aria-label={`${activeBook.title}${activeCourseMap.lessons.length}节课程地图`}>
          <img className="adventure-map-background" src={wonderTownMap} alt="" aria-hidden="true" draggable={false} />
          {activeCourseMap.lessons.map((lesson, index) => {
            const point = adventureRoutePoints[index];
            const side = point.x > 50 ? "side-left" : "side-right";
            const lessonProgress = getLessonProgress(lesson, activeCourseIndex, index, demoState);
            const status = lessonProgress.status;
            return <div id={status === "current" ? "current-adventure-node" : undefined} className={`adventure-stop status-${status} ${side}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} key={`${activeBook.title}-${lesson.number}`}>
              {status === "current" && <span className="current-node-callout"><strong>{lesson.title}</strong><em>{lesson.meta} · {lessonProgress.label}</em></span>}
              <button type="button" className="adventure-node" disabled={status === "locked"} onClick={() => { if (status !== "locked") setPendingLessonIndex(index); }} aria-label={`第 ${lesson.number} 课 ${lesson.title}，${status === "done" ? "已完成" : status === "current" ? "继续学习" : "尚未解锁"}`}><span>{status === "done" ? "✓" : lesson.number}</span></button>
              <span className="adventure-node-emoji" aria-hidden="true">{lesson.icon}</span>
            </div>;
          })}
        </div>
      </section>

      {pendingLesson && <div className="lesson-confirm-layer" onClick={() => setPendingLessonIndex(null)}>
        <section className="lesson-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-confirm-title" onClick={(event) => event.stopPropagation()}>
          <button className="lesson-confirm-close" type="button" aria-label="关闭课程确认" onClick={() => setPendingLessonIndex(null)}>×</button>
          <span className="lesson-confirm-icon" aria-hidden="true">{pendingLesson.icon}</span>
          <div className="lesson-confirm-copy">
            <small>准备开始</small>
            <h2 id="lesson-confirm-title">{pendingLesson.title}</h2>
            <p>{pendingLesson.meta}</p>
          </div>
          <div className="lesson-confirm-meta"><span>第 {pendingLesson.number} 节</span><strong>{pendingLessonProgress?.status === "done" ? "奖励已领取" : "+10 ⭐"}</strong></div>
          <div className="lesson-confirm-actions">
            <button type="button" onClick={() => setPendingLessonIndex(null)}>再看看</button>
            <button type="button" autoFocus onClick={() => { const index = pendingLessonIndex; setPendingLessonIndex(null); if (index != null) openLesson(index); }}>{pendingLessonProgress?.status === "done" ? "重新学习" : pendingLessonProgress?.completed ? "继续学习" : "开始学习"}</button>
          </div>
        </section>
      </div>}
    </StudentPage>
  );
}

function AiPage({ onNavigate, runtime }: { onNavigate: (tab: StudentTab) => void; runtime: SpeechRuntime }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "lumi" | "student"; text: string; translation: string }>>([{ role: "lumi", text: "Hi，小鹿！今天想聊动物、学校，还是听一个英语故事？", translation: "嗨，小鹿！选择一个你喜欢的话题吧。" }]);
  useEffect(() => () => { void runtime.cancelRecording(); }, [runtime]);

  const sendMessage = async (text: string) => {
    const value = text.trim();
    if (!value || waiting) return;
    const userMessage = { role: "student" as const, text: value, translation: "" };
    const history = [...messages, userMessage]
      .slice(-20)
      .map((message) => ({ role: message.role === "lumi" ? "assistant" as const : "user" as const, content: message.text }));
    setMessages((items) => [...items, userMessage]);
    setInput("");
    setWaiting(true);
    try {
      const reply = await runtime.chatWithLumi(history);
      const english = typeof reply?.english === "string" ? reply.english.trim() : "";
      const translation = typeof reply?.translation === "string" ? reply.translation.trim() : "";
      if (!english) throw new Error("AI 返回了空回复");
      setMessages((items) => [...items, { role: "lumi", text: english, translation }]);
    } catch (error) {
      console.warn("Could not display AI reply; using local demo reply", error);
      // 云端 AI 未配置时保留一个安全的演示回复，课程与语音功能不被阻断。
      setMessages((items) => [...items, { role: "lumi", text: "Great choice! Let’s say it together: I like pandas!", translation: "很棒！我们一起说：我喜欢熊猫！（当前为本地演示回复）" }]);
    } finally {
      setWaiting(false);
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void sendMessage(input); };
  const toggleVoice = async () => {
    setVoiceError("");
    try {
      if (!listening) {
        await runtime.startRecording();
        setListening(true);
      } else {
        const text = await runtime.stopAndTranscribe();
        setInput(text);
        setListening(false);
      }
    } catch (error) {
      setListening(false);
      setVoiceError(error instanceof Error ? error.message : "语音输入失败，请重试");
    }
  };
  return (
    <StudentPage active="ai" onNavigate={onNavigate} label="AI英语伙伴页面">
      <div className="ai-page-layout"><PageHeader eyebrow="LUMI AI BUDDY" title="AI 英语伙伴" />
        <Card className="ai-companion-card" tone="violet"><LumiMascot size="medium" /><div><strong>Lumi 在这里</strong><p>可以说中文，也可以试试英语。说错没关系，我会给你小提示。</p></div><span>✨</span></Card>
        <div className="chat-list" aria-live="polite">{messages.map((message, index) => <div className={`chat-row ${message.role}`} key={`${message.role}-${index}`}><div className="chat-bubble"><strong>{message.text}</strong>{message.translation && <small>{message.translation}</small>}{message.role === "lumi" && <button type="button" aria-label="播放回答" onClick={() => void runtime.speakText(message.text)}>🔊</button>}</div></div>)}{waiting && <div className="chat-row lumi"><div className="chat-bubble"><strong>正在想一想…</strong></div></div>}</div>
        <div className="quick-prompts" aria-label="快捷提问">{["我想聊动物", "讲个小故事", "陪我练口语"].map((text) => <button key={text} type="button" disabled={waiting} onClick={() => void sendMessage(text)}>{text}</button>)}</div>
        {voiceError && <p className="voice-error" role="alert">{voiceError}</p>}
        <form className="chat-composer" onSubmit={submit}><button className={listening ? "voice-button listening" : "voice-button"} type="button" aria-label={listening ? "完成语音输入" : "开始语音输入"} onClick={() => void toggleVoice()}>{listening ? "◼" : "🎙"}</button><input value={input} disabled={waiting} onChange={(event) => setInput(event.target.value)} placeholder={listening ? "正在听你说…" : "输入想问的问题"} aria-label="向Lumi提问" /><button className="send-button" type="submit" disabled={waiting || !input.trim()} aria-label="发送消息">↑</button></form>
      </div>
    </StudentPage>
  );
}

const assignmentItems = [
  { id: "workbook", title: "练习册第 12 页", subject: "奇妙小镇冒险", detail: "拍照上传 · 约 8 分钟", icon: "写", tone: "yellow", progress: 25, reward: 8 },
  { id: "reading", title: "At the zoo 口语朗读", subject: "英语口语", detail: "朗读 3 句话 · 约 5 分钟", icon: "说", tone: "pink", progress: 0, reward: 6 },
  { id: "writing", title: "My family 小作文", subject: "写作练习", detail: "老师已收到这份作文", icon: "文", tone: "sky", progress: 100, reward: 10 },
];

type MistakeItem = {
  id: string;
  type: "单词" | "句子" | "听力";
  icon: string;
  question: string;
  wrong: string;
  correct: string;
  note: string;
  reviews: string;
  tone: string;
  activity: Activity;
  cloud?: { sessionId: number; wrongItemId: number };
};

const mistakeItems: MistakeItem[] = [
  { id: "bag-meaning", type: "单词", icon: "Aa", question: "bag 是什么意思？", wrong: "盒子", correct: "书包", note: "容易和 box 混淆", reviews: "易混淆", tone: "violet", activity: { type: "recall", mode: "en_to_zh", prompt: "bag", answer: "书包", message: "这次把 bag 和 box 分清楚。" } },
  { id: "mom-sentence", type: "句子", icon: "句", question: "This is my mom.", wrong: "这是我的姐姐。", correct: "这是我的妈妈", note: "mom 表示妈妈", reviews: "已错 2 次", tone: "mint", activity: { type: "recall", mode: "en_to_zh", prompt: "This is my mom.", answer: "这是我的妈妈", message: "先理解整句话，再重新写出意思。" } },
  { id: "apple-listening", type: "听力", icon: "听", question: "听音写词：apple", wrong: "orange", correct: "apple", note: "注意开头的 /æ/", reviews: "需巩固", tone: "sky", activity: { type: "recall", mode: "audio_to_text", prompt: "apple", answer: "apple", message: "竖起耳朵，听清 /æ/ 开头的单词。" } },
];

function HomeworkPage({ onNavigate, demo, onNotice, cloudAssignments, cloudWrongItems, onStartCloudReview, onCloudReviewAnswer, onAssignmentFeedbackResponse }: { onNavigate: (tab: StudentTab) => void; demo: DemoController; onNotice: (message: string) => void; cloudAssignments: CloudAssignment[]; cloudWrongItems: CloudWrongItem[]; onStartCloudReview: () => Promise<{ ok: boolean; error?: string; session?: { id: number; items: CloudWrongItem[] } }>; onCloudReviewAnswer: (sessionId: number, wrongItemId: number, correct: boolean) => Promise<{ ok: boolean }>; onAssignmentFeedbackResponse: (assignmentId: number, response: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [mode, setMode] = useState<"assignments" | "mistakes">("assignments");
  const [mistakeFilter, setMistakeFilter] = useState("全部");
  const [reviewQueue, setReviewQueue] = useState<MistakeItem[] | null>(null);
  const [reviewStep, setReviewStep] = useState(0);
  const [reviewResults, setReviewResults] = useState<Record<string, boolean>>({});
  const [reviewReward, setReviewReward] = useState(0);
  const [feedbackResponses, setFeedbackResponses] = useState<Record<number, string>>({});
  const visibleMistakes = mistakeFilter === "全部" ? mistakeItems : mistakeItems.filter((item) => item.type === mistakeFilter);
  const assignmentProgress = (id: string, fallback: number) => demo.state.assignmentProgress[id] ?? fallback;
  const pendingAssignments = assignmentItems.filter((item) => assignmentProgress(item.id, item.progress) < 100);
  const pendingCloudAssignments = cloudAssignments.filter((item) => item.progress.status !== "completed");
  const activeCloudWrongItems = cloudWrongItems.filter((item) => item.status === "active");
  const pendingMistakes = mistakeItems.filter((item) => !demo.state.reviewedMistakes.includes(item.id));
  const focusAssignment = pendingAssignments[0] ?? assignmentItems[assignmentItems.length - 1];
  const focusProgress = assignmentProgress(focusAssignment.id, focusAssignment.progress);
  const continueAssignment = (id: string) => {
    const item = assignmentItems.find((entry) => entry.id === id);
    if (!item) return;
    const current = assignmentProgress(id, item.progress);
    if (current >= 100) {
      onNotice("这项作业已经完成啦");
      return;
    }
    const next = Math.min(100, current + 25);
    demo.patch((state) => ({
      assignmentProgress: { ...state.assignmentProgress, [id]: next },
      stars: next === 100 ? state.stars + item.reward : state.stars,
    }));
    onNotice(next === 100 ? `作业完成，获得 ${item.reward} 颗星星！` : `作业进度更新为 ${next}%`);
  };
  const respondToFeedback = async (assignmentId: number) => {
    const response = (feedbackResponses[assignmentId] || "").trim();
    if (!response) { onNotice("先写一句给老师的回复吧"); return; }
    const result = await onAssignmentFeedbackResponse(assignmentId, response);
    onNotice(result.ok ? "回复已发送给老师" : result.error || "回复失败，请稍后重试");
  };
  const startReview = (items: MistakeItem[]) => {
    if (!items.length) return;
    setReviewQueue(items);
    setReviewStep(0);
    setReviewResults({});
    setReviewReward(0);
  };
  const startSyncedReview = async () => {
    const result = await onStartCloudReview();
    if (!result.ok || !result.session) {
      onNotice(result.error || "今天没有到期的云端错题");
      return;
    }
    const session = result.session;
    startReview(session.items.map((item) => ({
      id: `cloud-${item.id}`, type: item.kind === "word" ? "单词" : "句子", icon: "云",
      question: item.prompt, wrong: `累计错误 ${item.error_count} 次`, correct: item.correct_answer || "按课程标准判定",
      note: `当前掌握度 ${item.mastery_level}/4`, reviews: `已复习 ${item.review_count} 次`, tone: "mint",
      activity: { type: "recall", mode: "zh_to_en", prompt: item.prompt, answer: item.correct_answer || item.prompt, message: "这是跨设备同步的到期错题。" },
      cloud: { sessionId: session.id, wrongItemId: item.id },
    })));
  };
  const leaveReview = () => setReviewQueue(null);
  const reviewPresentation = getCoursePresentation("mistake_review");
  const currentMistake = reviewQueue?.[reviewStep];
  const finishReviewStep = () => {
    if (!reviewQueue || !currentMistake) return;
    const correct = reviewResults[currentMistake.id] === true;
    if (currentMistake.cloud) {
      void onCloudReviewAnswer(currentMistake.cloud.sessionId, currentMistake.cloud.wrongItemId, correct);
      onNotice(correct ? "复习结果已同步，下一次间隔已延长" : "已同步，本题明天会再次出现");
      setReviewStep((value) => value + 1);
      return;
    }
    const newlyMastered = correct && !demo.state.reviewedMistakes.includes(currentMistake.id);
    if (newlyMastered) {
      demo.patch((state) => ({ reviewedMistakes: [...state.reviewedMistakes, currentMistake.id], stars: state.stars + 2 }));
      setReviewReward((value) => value + 2);
      onNotice("重新答对，获得 2 颗星星！");
    } else if (!correct) {
      onNotice("这题还需要加强，已经继续留在错题本");
    }
    setReviewStep((value) => value + 1);
  };

  if (reviewQueue && reviewStep >= reviewQueue.length) {
    const correct = Object.values(reviewResults).filter(Boolean).length;
    return <StudentPage active="homework" onNavigate={onNavigate} label="错题复习完成页面" hideNav><LessonComplete variant="review" correct={correct} total={reviewQueue.length} presentation={reviewPresentation} reward={reviewReward} onRestart={() => startReview(reviewQueue)} onHome={leaveReview} /></StudentPage>;
  }

  if (reviewQueue && currentMistake) {
    return (
      <StudentPage active="homework" onNavigate={onNavigate} label="错题修炼场" hideNav>
        <header className="lesson-focus-header">
          <button type="button" onClick={leaveReview} aria-label="退出复习并返回错题本">×</button>
          <div><strong>错题修炼场</strong><span>{currentMistake.type} · 找出误区再答一次</span></div>
          <b className="lesson-score">↻ {reviewStep + 1}/{reviewQueue.length}</b>
        </header>
        <LessonRenderer activity={currentMistake.activity} presentation={reviewPresentation} step={reviewStep} total={reviewQueue.length} onCompleted={(correct) => setReviewResults((results) => ({ ...results, [currentMistake.id]: correct }))} onNext={finishReviewStep} onPrevious={() => setReviewStep((value) => Math.max(0, value - 1))} canPrevious={reviewStep > 0} />
      </StudentPage>
    );
  }
  return (
    <StudentPage active="homework" onNavigate={onNavigate} label="作业与错题复习中心">
      <header className="study-desk-header">
        <div><span>STUDY DESK</span><h1>作业与复习</h1></div>
        <div className={`study-desk-count ${mode}`}><strong>{mode === "assignments" ? pendingAssignments.length + pendingCloudAssignments.length : pendingMistakes.length + activeCloudWrongItems.length}</strong><small>{mode === "assignments" ? "待完成" : "待复习"}</small></div>
      </header>
      <div className="study-desk-tabs" role="tablist" aria-label="作业与错题切换">
        <button type="button" role="tab" aria-selected={mode === "assignments"} className={mode === "assignments" ? "selected" : ""} onClick={() => setMode("assignments")}><span>✓</span><strong>我的作业</strong><b>{pendingAssignments.length + pendingCloudAssignments.length}</b></button>
        <button type="button" role="tab" aria-selected={mode === "mistakes"} className={mode === "mistakes" ? "selected" : ""} onClick={() => setMode("mistakes")}><span>↻</span><strong>错题本</strong><b>{pendingMistakes.length + activeCloudWrongItems.length}</b></button>
      </div>

      {mode === "assignments" ? <>
        <section className="assignment-focus-card">
          <div className="assignment-progress-ring" style={{ background: `radial-gradient(circle at center,#fff 57%,transparent 59%),conic-gradient(var(--violet) 0 ${Math.round((assignmentItems.length - pendingAssignments.length) / assignmentItems.length * 100)}%,#ddd9f8 0 100%)` }} aria-label={`今日作业完成 ${assignmentItems.length - pendingAssignments.length} 项`}><strong>{assignmentItems.length - pendingAssignments.length}</strong><small>/ {assignmentItems.length}</small></div>
          <div><span>{pendingAssignments.length ? "接着完成" : "今日任务"}</span><h2>{pendingAssignments.length ? focusAssignment.title : "作业全部完成"}</h2><p>{pendingAssignments.length ? `${focusAssignment.detail}，当前已完成 ${focusProgress}%。` : "做得真棒，去错题本巩固一下吧。"}</p><div className="assignment-focus-progress"><i style={{ width: `${focusProgress}%` }} /></div></div>
          <button type="button" onClick={() => pendingAssignments.length ? continueAssignment(focusAssignment.id) : setMode("mistakes")}>{pendingAssignments.length ? "继续完成 ›" : "去复习 ›"}</button>
        </section>
        <div className="study-section-heading"><div><span>TODAY</span><h2>今天的任务</h2></div><small>按截止时间排列</small></div>
        {cloudAssignments.length > 0 && <div className="cloud-learning-list" aria-label="云端作业">{cloudAssignments.map((item) => { const percent = Math.min(100, Math.round(item.progress.completed_activities / item.total_activities * 100)); return <article key={item.id}><span>云</span><div><small>老师布置 · {item.section_id}</small><strong>{item.title}</strong><p>{item.instructions || "完成指定课程活动，进度会自动同步。"}</p><i><b style={{ width: `${percent}%` }} /></i>{item.feedback && <section className="teacher-feedback"><small>{item.feedback.teacher.name}老师的评语</small><p>{item.feedback.comment}</p>{item.feedback.student_response ? <em>我的回复：{item.feedback.student_response}</em> : <div><input aria-label={`回复《${item.title}》的老师评语`} value={feedbackResponses[item.id] || ""} maxLength={500} placeholder="谢谢老师，我会继续努力！" onChange={(event) => setFeedbackResponses((items) => ({ ...items, [item.id]: event.currentTarget.value }))} /><button type="button" onClick={() => void respondToFeedback(item.id)}>回复老师</button></div>}</section>}</div><em>{percent}%</em></article>; })}</div>}
        <div className="assignment-card-list">{assignmentItems.map((item) => { const progress = assignmentProgress(item.id, item.progress); return <button type="button" className={`assignment-card tone-${item.tone}`} aria-label={`进入任务：${item.title}`} key={item.title} onClick={() => continueAssignment(item.id)}>
          <span className="assignment-type-icon">{item.icon}</span>
          <span className="assignment-card-copy"><small>{item.subject}</small><strong>{item.title}</strong><p>{progress >= 100 ? "已完成 · 奖励已领取" : item.detail}</p><span className="assignment-card-progress"><i style={{ width: `${progress}%` }} /></span></span>
          <span className="assignment-card-reward">{progress >= 100 ? "✓" : `+${item.reward} ⭐`}</span>
        </button>; })}</div>
        <button className="mistake-book-teaser" type="button" onClick={() => setMode("mistakes")}><span>↻</span><div><small>错题本</small><strong>{pendingMistakes.length} 道题正在等你重新挑战</strong></div></button>
      </> : <>
        {cloudWrongItems.length > 0 && <section className="cloud-wrongbook" aria-label="云端错题本"><header><div><span>SYNCED WRONG BOOK</span><strong>跨设备错题记录</strong></div><em>{activeCloudWrongItems.length} 待掌握</em></header>{cloudWrongItems.map((item) => <article key={item.id}><div><small>{item.kind} · 错误 {item.error_count} 次</small><strong>{item.prompt}</strong><p>正确答案：{item.correct_answer || "按课程标准判定"}</p></div><span className={`mastery level-${item.mastery_level}`}>{item.status === "mastered" ? "已掌握" : `掌握度 ${item.mastery_level}/4`}</span></article>)}<button className="cloud-review-button" type="button" onClick={() => void startSyncedReview()}>开始今日云端复习 →</button></section>}
        <section className="mistake-review-hero">
          <div><span>SMART REVIEW</span><h2>{pendingMistakes.length ? `今天复习 ${pendingMistakes.length} 题` : "今天的错题已掌握"}</h2><p>{pendingMistakes.length ? "不只是看答案：重新答对，才算真正掌握。" : "可以再挑战一轮，看看能不能一次全对。"}</p><button type="button" onClick={() => startReview(pendingMistakes.length ? pendingMistakes : mistakeItems)}>{pendingMistakes.length ? "开始连续复习 →" : "再巩固一遍 →"}</button></div>
          <div className="review-orbit" aria-hidden="true"><span>Aa</span><i>↻</i><b>{pendingMistakes.length}</b></div>
        </section>
        <div className="mistake-filter-row" role="tablist" aria-label="错题类型">{["全部", "单词", "句子", "听力"].map((filter) => <button type="button" role="tab" aria-selected={mistakeFilter === filter} className={mistakeFilter === filter ? "selected" : ""} key={filter} onClick={() => setMistakeFilter(filter)}>{filter}</button>)}</div>
        <div className="mistake-card-list">{visibleMistakes.map((item) => { const reviewed = demo.state.reviewedMistakes.includes(item.id); return <button type="button" className={`mistake-review-card tone-${item.tone}${reviewed ? " reviewed" : ""}`} aria-label={`进入错题学习：${item.question}`} key={item.question} onClick={() => startReview([item])}>
          <span className="mistake-card-top"><span>{item.icon}</span><span><small>{item.type} · {item.reviews}</small><strong>{item.question}</strong></span></span>
          <div className="mistake-answer-compare"><div><small>上次回答</small><strong>{item.wrong}</strong></div><span>→</span><div><small>正确答案</small><strong>{item.correct}</strong></div></div>
          <p>{reviewed ? "✓ 已巩固" : `记忆提示：${item.note}`}</p>
        </button>; })}</div>
      </>}
    </StudentPage>
  );
}

type GrowthPageProps = {
  onNavigate: (tab: StudentTab) => void; onLogout: () => void; onSwitchAccount: () => void;
  user: AuthUser; demo: DemoController; onNotice: (message: string) => void;
  points: PointsAccount; storeItems: StoreItem[]; growth: GrowthSummary | null;
  onPurchase: (itemId: number) => Promise<{ ok: boolean; error?: string }>;
  onEquip: (itemId: number) => Promise<{ ok: boolean; error?: string }>;
};

function GrowthPage({ onNavigate, onLogout, onSwitchAccount, user, demo, onNotice, points, storeItems, growth, onPurchase, onEquip }: GrowthPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showBookLibrary, setShowBookLibrary] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [storeBusy, setStoreBusy] = useState<number | null>(null);
  const activeCourseIndex = demo.state.activeCourseIndex;
  const [selectedBookIndex, setSelectedBookIndex] = useState(activeCourseIndex);
  const settings = demo.state.settings;
  const activeMap = courseAdventureMaps[activeCourseIndex] ?? courseAdventureMaps[0];
  const activeBook = courseBooks[activeMap.bookIndex];
  const toggleSetting = (key: keyof typeof settings) => {
    demo.patch({ settings: { ...settings, [key]: !settings[key] } });
    onNotice("设置已保存");
  };
  const completedLessons = Object.values(demo.state.lessonProgress).filter((progress) => progress.completed).length;
  const completedAssignments = Object.values(demo.state.assignmentProgress).filter((progress) => progress >= 100).length;

  useEffect(() => {
    if (!showSettings) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSettings(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showSettings]);

  const openBookLibrary = () => {
    setSelectedBookIndex(activeCourseIndex);
    setShowBookLibrary(true);
  };
  const applySelectedBook = () => {
    demo.patch({ activeCourseIndex: selectedBookIndex });
    setShowBookLibrary(false);
    onNotice(`已切换到《${courseBooks[courseAdventureMaps[selectedBookIndex].bookIndex].title}》`);
    document.querySelector<HTMLElement>(".page-scroll-content")?.scrollTo({ top: 0 });
  };

  if (showBookLibrary) {
    const selectedMap = courseAdventureMaps[selectedBookIndex] ?? courseAdventureMaps[0];
    const selectedBook = courseBooks[selectedMap.bookIndex];
    return (
      <StudentPage active="growth" onNavigate={onNavigate} label="书籍选择页面">
        <PageHeader eyebrow="MY BOOKS" title="选择书籍" onBack={() => setShowBookLibrary(false)} trailing={<Pill tone="violet">{courseAdventureMaps.length} 本</Pill>} />
        <div className="full-book-library" role="listbox" aria-label="所有可选书籍">{courseAdventureMaps.map((course, index) => {
          const book = courseBooks[course.bookIndex];
          return <button type="button" role="option" aria-selected={index === selectedBookIndex} className={index === selectedBookIndex ? "selected" : ""} key={book.title} onClick={() => setSelectedBookIndex(index)}><BookCover book={book} /><span><small>{book.series}</small><strong>{book.title}</strong><em>{book.grade}</em><span><i style={{ width: `${book.progress}%` }} /></span><b>{book.progress}%</b></span>{index === selectedBookIndex && <i className="book-selected-mark">✓</i>}</button>;
        })}</div>
        <div className="book-library-apply"><span><small>已选择</small><strong>{selectedBook.title}</strong></span><button type="button" onClick={applySelectedBook}>{selectedBookIndex === activeCourseIndex ? "继续使用" : "应用这本书"}</button></div>
      </StudentPage>
    );
  }

  if (showStore) {
    const actOnItem = async (item: StoreItem) => {
      if (storeBusy !== null) return;
      setStoreBusy(item.id);
      const result = item.owned ? await onEquip(item.id) : await onPurchase(item.id);
      if (result.ok) {
        if (item.owned && item.category === "skin" && mascotSkins.some((skin) => skin.id === item.preview)) {
          demo.patch({ mascotSkin: item.preview as MascotSkin });
        }
        onNotice(item.owned ? `已装备${item.name}` : `已购买${item.name}，可立即装备`);
      } else onNotice(result.error || "操作失败，请稍后重试");
      setStoreBusy(null);
    };
    return <StudentPage active="growth" onNavigate={onNavigate} label="积分商城页面">
      <PageHeader eyebrow="LUMI STORE" title="积分商城" onBack={() => setShowStore(false)} trailing={<Pill tone="yellow">★ {points.balance}</Pill>} />
      <section className="store-wallet"><span>★</span><div><small>可用积分</small><strong>{points.balance}</strong><p>答题、完成课程和掌握错题都能获得积分</p></div></section>
      <div className="store-item-grid">{storeItems.map((item) => <article className={`store-item-card preview-${item.preview || "default"}`} key={item.id}>
        <div className="store-item-preview" aria-hidden="true"><span>{item.category === "background" ? "☁" : "🐻"}</span><i /></div>
        <small>{item.category === "skin" ? "LUMI 装扮" : "学习空间"}</small><strong>{item.name}</strong><p>{item.description || "让学习空间更有自己的风格"}</p>
        <button type="button" disabled={storeBusy !== null || item.equipped || (!item.owned && points.balance < item.price)} onClick={() => void actOnItem(item)}>{storeBusy === item.id ? "处理中…" : item.equipped ? "已装备" : item.owned ? "立即装备" : points.balance < item.price ? `还差 ${item.price - points.balance} 分` : `★ ${item.price} 购买`}</button>
      </article>)}</div>
      {!storeItems.length && <Card className="store-empty">商城商品准备中，稍后再来看看吧。</Card>}
    </StudentPage>;
  }

  return (
    <StudentPage active="growth" onNavigate={onNavigate} label="我的学习页面">
      <header className="personal-hub-header"><div><span>MY SPACE</span><h1>我的学习</h1><p>书架、活动和学习记录都在这里</p></div><button className="personal-settings-button" type="button" aria-label="打开设置" onClick={() => setShowSettings(true)}>⚙</button></header>

      <section className="user-profile-overview" aria-label="当前用户信息">
        <div className="user-profile-avatar" aria-hidden="true">鹿</div>
        <div className="user-profile-copy"><small>当前账号 · {user.username}</small><h2>{user.name}</h2><p>学生学习空间</p><div><span>Lv.{Math.floor(points.balance / 100) + 1} 小小探险家</span><span>🔥 连续 {demo.state.checkInDays} 天</span></div></div>
        <button className="user-profile-stars" type="button" onClick={() => setShowStore(true)} aria-label={`打开积分商城，余额 ${points.balance}`}><span>★</span><strong>{points.balance}</strong><small>积分商城 ›</small></button>
      </section>

      <section className="growth-badge-section">
        <div className="personal-section-heading"><div><span>ACHIEVEMENTS</span><h2>成长徽章</h2></div><small>{growth?.badges.length ?? 0} 枚已解锁</small></div>
        <div className="cloud-badge-grid">{growth?.badges.length ? growth.badges.map((badge) => <article key={badge.code}><span>{badge.icon}</span><div><strong>{badge.name}</strong><small>{badge.description}</small></div></article>) : <p>完成第一个云端学习活动，就会点亮成长徽章。</p>}</div>
      </section>

      <section className="book-switch-section">
        <div className="personal-section-heading"><div><span>MY BOOK</span><h2>学习书籍</h2></div><button type="button" onClick={openBookLibrary}>管理书架</button></div>
        <article className="active-book-overview"><BookCover book={activeBook} compact /><div><small>当前使用</small><h3>{activeBook.title}</h3><p>{activeBook.grade} · {activeBook.series}</p><div className="active-book-progress"><span><i style={{ width: `${activeBook.progress}%` }} /></span><strong>{activeBook.progress}%</strong></div><div className="active-book-actions"><button type="button" onClick={openBookLibrary}>切换书籍</button><button type="button" onClick={() => onNavigate("home")}>回到地图</button></div></div></article>
      </section>

      <section className="learning-stat-section">
        <div className="personal-section-heading"><div><span>STATISTICS</span><h2>学习成长统计</h2></div><small>最近 7 天</small></div>
        <div className="learning-stat-grid"><div><span>本周活动</span><strong>{growth?.weekly_learning_events ?? 0}<small>次</small></strong><em>服务端学习记录</em></div><div><span>完成课程</span><strong>{growth?.completed_lessons ?? completedLessons}<small>节</small></strong><em>稳定推进中</em></div><div><span>完成任务</span><strong>{growth?.completed_assignments ?? completedAssignments}<small>项</small></strong><em>课程与作业</em></div><div><span>复习正确率</span><strong>{growth?.review_accuracy ?? 0}<small>%</small></strong><em>{growth?.review_total ?? 0} 次复习记录</em></div></div>
        <div className="growth-stage-feedback"><span>✦</span><div><strong>{(growth?.weekly_learning_events ?? 0) > 0 ? "本周已经出发，继续保持！" : "完成一次学习，开启本周成长记录"}</strong><small>累计 {growth?.learning_events ?? 0} 次活动 · 掌握 {growth?.mastered_items ?? 0} 个薄弱点</small></div></div>
      </section>

      {showSettings && <div className="settings-dialog-layer" onClick={() => setShowSettings(false)}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}>
        <header><div><span>SETTINGS</span><h2 id="settings-title">学习设置</h2></div><button type="button" aria-label="关闭设置" onClick={() => setShowSettings(false)}>×</button></header>
        <div className="settings-group"><strong>声音与提醒</strong>{[
          ["sound", "课程声音", "播放单词、句子和反馈音"],
          ["reminder", "每日学习提醒", "每天 19:30 提醒我学习"],
          ["effects", "动画与庆祝效果", "答对后显示星星和动画"],
          ["slowSpeech", "慢速发音优先", "首次播放使用较慢语速"],
        ].map(([key, title, detail]) => <button type="button" className="settings-toggle-row" aria-pressed={settings[key as keyof typeof settings]} key={key} onClick={() => toggleSetting(key as keyof typeof settings)}><span><strong>{title}</strong><small>{detail}</small></span><i className={settings[key as keyof typeof settings] ? "on" : ""}><b /></i></button>)}</div>
        <div className="settings-group"><strong>通用</strong><button type="button" className="settings-link-row" onClick={() => onNotice("演示版每日学习目标为 30 分钟")}><span><strong>学习时间管理</strong><small>每日 30 分钟</small></span><b>›</b></button><button type="button" className="settings-link-row" onClick={() => onNotice("正式版可接入家长报告与内容安全设置")}><span><strong>家长与隐私</strong><small>内容安全与使用报告</small></span><b>›</b></button><button type="button" className="settings-link-row account-switch-row" onClick={() => { setShowSettings(false); onSwitchAccount(); }}><span><strong>切换账号</strong><small>当前：{user.name}</small></span><b>›</b></button><button type="button" className="settings-link-row" onClick={() => onNotice("Lumi 英语学习演示版 · v0.1.0")}><span><strong>关于 Lumi</strong><small>版本与服务说明</small></span><b>›</b></button></div>
        <button className="settings-reset-demo" type="button" onClick={() => { demo.reset(); setShowSettings(false); onNotice("演示数据已重置"); }}>重置演示数据</button>
        <button className="settings-logout" type="button" onClick={onLogout}>退出当前账号</button>
      </section></div>}
    </StudentPage>
  );
}

type StudentAppProps = SpeechRuntime & {
  publishedCourses: PublishedCourse[];
  cloudProgress: CloudProgress[];
  cloudWrongItems: CloudWrongItem[];
  cloudAssignments: CloudAssignment[];
  points: PointsAccount;
  storeItems: StoreItem[];
  growth: GrowthSummary | null;
  onPurchase: (itemId: number) => Promise<{ ok: boolean; error?: string }>;
  onEquip: (itemId: number) => Promise<{ ok: boolean; error?: string }>;
  onLearningEvent: (event: LearningEventInput) => Promise<{ ok: boolean }>;
  onStartCloudReview: () => Promise<{ ok: boolean; error?: string; session?: { id: number; items: CloudWrongItem[] } }>;
  onCloudReviewAnswer: (sessionId: number, wrongItemId: number, correct: boolean) => Promise<{ ok: boolean }>;
  onAssignmentFeedbackResponse: (assignmentId: number, response: string) => Promise<{ ok: boolean; error?: string }>;
  authReady: boolean;
  authenticatedUser: AuthUser | null;
  onLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string; user?: AuthUser }>;
  onLogout: () => Promise<void>;
  dom?: import("expo/dom").DOMProps;
};

export default function StudentApp({ dom: _dom, authReady, authenticatedUser, onLogin, onLogout, publishedCourses, cloudProgress, cloudWrongItems, cloudAssignments, points, storeItems, growth, onPurchase, onEquip, onLearningEvent, onStartCloudReview, onCloudReviewAnswer, onAssignmentFeedbackResponse, ...speechRuntime }: StudentAppProps) {
  const [screen, setScreen] = useState<Screen>("login");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const demo = useDemoState(authenticatedUser ? `user-${authenticatedUser.id}` : "guest");
  useEffect(() => {
    if (!authenticatedUser || !cloudProgress.length) return;
    demo.patch((current) => {
      const lessonProgress = { ...current.lessonProgress };
      for (const progress of cloudProgress) {
        const local = lessonProgress[progress.client_progress_key];
        if (!local || progress.completed_activities !== local.completedActivities || (progress.status === "completed") !== local.completed) {
          lessonProgress[progress.client_progress_key] = { completedActivities: progress.completed_activities, completed: progress.status === "completed" };
        }
      }
      return { lessonProgress };
    });
  }, [authenticatedUser?.id, cloudProgress]);
  const runtime = useMemo<SpeechRuntime>(() => ({
    ...speechRuntime,
    speakText: (text, options) => {
      if (!demo.state.settings.sound) return Promise.resolve();
      return speechRuntime.speakText(text, {
        ...options,
        rate: demo.state.settings.slowSpeech ? 0.68 : options?.rate,
      });
    },
  }), [
    speechRuntime.startRecording,
    speechRuntime.cancelRecording,
    speechRuntime.stopAndTranscribe,
    speechRuntime.stopAndEvaluate,
    speechRuntime.chatWithLumi,
    speechRuntime.checkDialog,
    speechRuntime.speakText,
    demo.state.settings.sound,
    demo.state.settings.slowSpeech,
  ]);
  useEffect(() => {
    const hostOs = (window as Window & { $$EXPO_DOM_HOST_OS?: string }).$$EXPO_DOM_HOST_OS;
    document.documentElement.dataset.lumiHost = hostOs ?? "web";
    document.documentElement.dataset.lumiSkin = demo.state.mascotSkin;
    document.documentElement.dataset.effects = demo.state.settings.effects ? "on" : "off";
    document.documentElement.dataset.sound = demo.state.settings.sound ? "on" : "off";
    document.documentElement.dataset.slowSpeech = demo.state.settings.slowSpeech ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.lumiHost;
      delete document.documentElement.dataset.lumiSkin;
      delete document.documentElement.dataset.effects;
      delete document.documentElement.dataset.sound;
      delete document.documentElement.dataset.slowSpeech;
    };
  }, [demo.state.mascotSkin, demo.state.settings.effects, demo.state.settings.slowSpeech, demo.state.settings.sound]);
  useEffect(() => () => {
    if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current);
  }, []);
  useEffect(() => {
    if (authenticatedUser && screen === "login") setScreen("role");
    if (authReady && !authenticatedUser && screen !== "login") setScreen("login");
  }, [authReady, authenticatedUser, screen]);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2200);
  };
  const navigate = (tab: StudentTab) => setScreen(tab);
  let page: React.ReactNode;
  if (screen === "login") page = <LoginPage authReady={authReady} onLogin={onLogin} onNotice={showNotice} />;
  else if (screen === "role") page = <RolePage onEnter={() => setScreen("home")} onBack={() => setScreen("login")} />;
  else if (screen === "ai") page = <AiPage onNavigate={navigate} runtime={runtime} />;
  else if (screen === "homework") page = <HomeworkPage onNavigate={navigate} demo={demo} onNotice={showNotice} cloudAssignments={cloudAssignments} cloudWrongItems={cloudWrongItems} onStartCloudReview={onStartCloudReview} onCloudReviewAnswer={onCloudReviewAnswer} onAssignmentFeedbackResponse={onAssignmentFeedbackResponse} />;
  else if (screen === "growth" && authenticatedUser) page = <GrowthPage onNavigate={navigate} onLogout={() => { void onLogout(); setScreen("login"); }} onSwitchAccount={() => { void onLogout(); setScreen("login"); }} user={authenticatedUser} demo={demo} onNotice={showNotice} points={points} storeItems={storeItems} growth={growth} onPurchase={onPurchase} onEquip={onEquip} />;
  else page = <AdventurePage onNavigate={navigate} demo={demo} publishedCourses={publishedCourses} cloudAssignments={cloudAssignments} onLearningEvent={onLearningEvent} />;
  return <SpeechRuntimeProvider runtime={runtime}>{page}<DemoToast message={notice} /></SpeechRuntimeProvider>;
}
