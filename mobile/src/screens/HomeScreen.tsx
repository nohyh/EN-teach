/** 学生首页复刻（原 HomePage + CheckInCalendar + CourseLibrary） */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Card, LumiMascot, PageHeader, P, Pill, ProgressBar, SectionTitle, StudentPage, TaskRow, type StudentTab } from "@/components/ui";

type Book = { title: string; englishTitle: string; grade: string; series: string; currentUnit: string; progress: number; cover: number };
const COURSE_BOOKS: Book[] = [
  { title: "奇妙小镇冒险", englishTitle: "Wonderful Town", grade: "小学一年级", series: "主题英语", currentUnit: "Unit 4 · 水果商店", progress: 42, cover: 0 },
  { title: "彩虹生活岛", englishTitle: "Rainbow Island", grade: "小学一年级", series: "主题英语", currentUnit: "Unit 2 · 我的家", progress: 18, cover: 1 },
  { title: "快乐校园日记", englishTitle: "Happy School", grade: "小学一年级", series: "绘本口语", currentUnit: "Unit 1 · 新朋友", progress: 8, cover: 2 },
  { title: "字母森林", englishTitle: "Alphabet Forest", grade: "小学一年级", series: "自然拼读", currentUnit: "Unit 3 · ABC树屋", progress: 35, cover: 3 },
  { title: "发音小火车", englishTitle: "Phonics Express", grade: "小学二年级", series: "自然拼读", currentUnit: "Unit 5 · sh与ch", progress: 56, cover: 4 },
  { title: "单词魔法屋", englishTitle: "Word Workshop", grade: "小学三年级", series: "自然拼读", currentUnit: "Unit 2 · 魔法拼写", progress: 20, cover: 5 },
  { title: "小熊环游记", englishTitle: "Bear Goes Around", grade: "小学四年级", series: "绘本口语", currentUnit: "Unit 6 · 山谷露营", progress: 68, cover: 6 },
  { title: "海底故事会", englishTitle: "Ocean Stories", grade: "幼儿园中班", series: "绘本口语", currentUnit: "Unit 1 · 蓝色朋友", progress: 12, cover: 7 },
];
const COVER_ART = [
  ["👋", "#dedaff", "#c7c0ff"], ["🏡", "#ffe4e8", "#ffd3db"], ["🏫", "#dcf3ff", "#c2e9fc"], ["🔤", "#e9f7d9", "#d5efc4"],
  ["🚂", "#fff2ce", "#ffe79f"], ["✨", "#ece9ff", "#dcd8ff"], ["🐻", "#dff8f3", "#c2efe5"], ["🐙", "#def3ff", "#c4e9fb"],
] as const;

function BookCover({ cover, compact = false }: { cover: number; compact?: boolean }) {
  const [emoji, from, to] = COVER_ART[cover % COVER_ART.length];
  return (
    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: compact ? 96 : "100%", height: compact ? 84 : 112, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ position: "absolute", left: 7, top: 5, fontSize: 8, fontWeight: "900", color: "rgba(49,43,131,.45)" }}>LUMI</Text>
      <Text style={{ fontSize: compact ? 28 : 36 }}>{emoji}</Text>
    </LinearGradient>
  );
}

const DEMO = { year: 2026, month: 7, day: 27 };
function isCheckedDay(month: number, day: number, hasCheckedIn: boolean) {
  if (month > DEMO.month || (month === DEMO.month && day > DEMO.day)) return false;
  if (month === DEMO.month && day === DEMO.day) return hasCheckedIn;
  if (month === DEMO.month && day >= DEMO.day - 12) return true;
  return (day + month * 2) % 5 !== 0 && (day + month) % 7 !== 0;
}

function CheckInCalendar({ onBack, days, hasCheckedIn, onCheckIn }: { onBack: () => void; days: number; hasCheckedIn: boolean; onCheckIn: () => void }) {
  const [month, setMonth] = useState(DEMO.month);
  const [success, setSuccess] = useState(false);
  const daysInMonth = new Date(DEMO.year, month + 1, 0).getDate();
  const firstWeekday = new Date(DEMO.year, month, 1).getDay();
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const cells: Array<number | null> = [...Array.from({ length: leading }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const current = month === DEMO.month;
  const checkedCount = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((day) => isCheckedDay(month, day, hasCheckedIn)).length;
  const handleCheckIn = () => {
    if (hasCheckedIn) return;
    onCheckIn();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 1800);
  };
  return (
    <StudentPage active="home" onNavigate={() => undefined}>
      <PageHeader eyebrow="DAILY CHECK-IN" title="签到日历" subtitle="每天来和 Lumi 打个招呼" onBack={onBack} trailing={<Pill tone="yellow">🔥 {days}天</Pill>} />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 30 }}>{hasCheckedIn ? "🔥" : "🕯️"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: P.muted, fontSize: 9 }}>连续签到</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: P.violetDeep }}>{days}<Text style={{ fontSize: 11 }}> 天</Text></Text>
          <Text style={{ color: P.muted, fontSize: 9 }}>{hasCheckedIn ? "今天已经留下小火苗啦！" : "今天的小火苗还在等你点亮"}</Text>
        </View>
        <LumiMascot size="small" mood={hasCheckedIn ? "happy" : "curious"} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable disabled={month === 0} onPress={() => setMonth((v) => Math.max(0, v - 1))}><Text style={{ fontSize: 20, color: month === 0 ? "#ccc" : P.violet }}>‹</Text></Pressable>
          <Text style={{ fontWeight: "900", color: P.ink }}><Text style={{ fontSize: 9, color: P.muted }}>{DEMO.year}年 </Text>{month + 1}月</Text>
          <Pressable disabled={month === 11} onPress={() => setMonth((v) => Math.min(11, v + 1))}><Text style={{ fontSize: 20, color: month === 11 ? "#ccc" : P.violet }}>›</Text></Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <Text style={{ color: P.muted, fontSize: 8, letterSpacing: 1 }}>MONTHLY RECORD</Text>
          <Pill tone="mint">已签到 {checkedCount} 天</Pill>
        </View>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          {["一", "二", "三", "四", "五", "六", "日"].map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {cells.map((day, index) => {
            if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
            const checked = isCheckedDay(month, day, hasCheckedIn);
            const past = month < DEMO.month || (month === DEMO.month && day < DEMO.day);
            const future = month > DEMO.month || (month === DEMO.month && day > DEMO.day);
            const today = current && day === DEMO.day;
            return (
              <View key={day} style={[styles.dayCell, styles.dayInner, checked && styles.dayChecked, future && { opacity: 0.45 }, today && styles.dayToday]}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: checked ? "#c26a00" : past ? "#b5bac6" : P.muted }}>{day}</Text>
                {!!checked && <Text style={{ fontSize: 8 }}>🔥</Text>}
                {!!today && <Text style={{ position: "absolute", bottom: -14, fontSize: 7, color: P.violet, fontWeight: "900" }}>今天</Text>}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: 14, marginTop: 16 }}>
          {[{ k: "checked", t: "已签到" }, { k: "missed", t: "未签到" }, { k: "future", t: "未来日期" }].map((legend) => (
            <View key={legend.k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: legend.k === "checked" ? P.sun : legend.k === "future" ? P.line : "#ffd9a1" }} />
              <Text style={{ fontSize: 8, color: P.muted }}>{legend.t}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={{ marginTop: 14 }}>
        {current ? (
          <Button disabled={hasCheckedIn} onPress={handleCheckIn}>{hasCheckedIn ? "✓ 今天已签到" : "🔥 点亮今天的小火苗"}</Button>
        ) : (
          <Button variant="secondary" onPress={() => setMonth(DEMO.month)}>回到本月签到</Button>
        )}
        {success && <Text style={{ textAlign: "center", marginTop: 8, color: P.mint, fontWeight: "900", fontSize: 10 }}>签到成功，连续 {days} 天！</Text>}
      </View>
    </StudentPage>
  );
}

function CourseLibrary({ onNavigate, onBack }: { onNavigate: (tab: StudentTab) => void; onBack: () => void }) {
  const grades = ["幼儿园小班", "幼儿园中班", "幼儿园大班", "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级"];
  const seriesList = ["全部系列", "主题英语", "自然拼读", "绘本口语"] as const;
  const [grade, setGrade] = useState("小学一年级");
  const [series, setSeries] = useState<(typeof seriesList)[number]>("全部系列");
  const visible = COURSE_BOOKS.filter((book) => book.grade === grade).filter((book) => series === "全部系列" || book.series === series);
  return (
    <StudentPage active="home" onNavigate={onNavigate}>
      <PageHeader eyebrow="COURSE LIBRARY" title="全部教材" subtitle="挑一本喜欢的绘本，开始今天的英语冒险" onBack={onBack} trailing={<Pill tone="violet">{visible.length} 本</Pill>} />
      <Card>
        <Text style={styles.filterHeading}>选择年级</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 8 }}>
          {grades.map((item) => (
            <Pressable key={item} onPress={() => setGrade(item)} style={[styles.gradeChip, grade === item && { backgroundColor: P.violet }]}>
              <Text style={{ color: grade === item ? "#fff" : P.muted, fontSize: 9, fontWeight: "800" }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 7, marginVertical: 8 }}>
          {seriesList.map((item) => (
            <Pressable key={item} onPress={() => setSeries(item)} style={[styles.seriesTab, series === item && { backgroundColor: P.violetSoft, borderColor: P.violet }]}>
              <Text style={{ color: series === item ? P.violet : P.muted, fontSize: 9, fontWeight: "800" }}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginVertical: 12 }}>
        <Text><Text style={{ color: P.violet, fontSize: 9, fontWeight: "900" }}>{grade}</Text><Text style={{ fontSize: 13, fontWeight: "900", color: P.ink }}> · {series}</Text></Text>
        <Text style={{ color: P.muted, fontSize: 9 }}>{visible.length} 本教材</Text>
      </View>
      {visible.length === 0 ? (
        <Card style={{ alignItems: "center", padding: 24, gap: 6 }}>
          <Text style={{ fontSize: 26 }}>📚</Text>
          <Text style={{ fontWeight: "900", color: P.ink }}>这个分类正在准备新教材</Text>
          <Text style={{ fontSize: 9, color: P.muted }}>先去看看其他年级或教材系列吧</Text>
        </Card>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {visible.map((book) => (
            <Pressable key={book.title} onPress={() => onNavigate("learn")} style={styles.libraryBook}>
              <BookCover cover={book.cover} />
              <Text style={{ color: P.muted, fontSize: 8, marginTop: 7 }}>{book.englishTitle}</Text>
              <Text style={{ fontSize: 11, fontWeight: "900", color: P.ink }}>{book.title}</Text>
              <Text style={{ fontSize: 8, color: P.muted, marginBottom: 6 }}>{book.grade} · {book.series}</Text>
              <ProgressBar value={book.progress} />
              <Text style={{ fontSize: 8, color: P.violetDeep, fontWeight: "800", marginTop: 4 }}>{book.progress > 0 ? `已学习 ${book.progress}%` : "还未开始"}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </StudentPage>
  );
}

export default function HomeScreen({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [days, setDays] = useState(12);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const homeBooks = COURSE_BOOKS.filter((book) => book.grade === "小学一年级");
  if (showCalendar) return <CheckInCalendar onBack={() => setShowCalendar(false)} days={days} hasCheckedIn={hasCheckedIn} onCheckIn={() => { if (!hasCheckedIn) { setDays((value) => value + 1); setHasCheckedIn(true); } }} />;
  if (showLibrary) return <CourseLibrary onNavigate={onNavigate} onBack={() => setShowLibrary(false)} />;
  return (
    <StudentPage active="home" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={styles.avatarTile}><LumiMascot size="small" /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: P.violet, fontSize: 8, fontWeight: "1000" as unknown as "900", letterSpacing: 1.2 }}>GOOD MORNING!</Text>
          <Text style={{ fontSize: 19, fontWeight: "900", color: P.ink, marginTop: 3 }}>早上好，陈小鹿</Text>
        </View>
        <Pressable onPress={() => setShowCalendar(true)} style={styles.checkinButton}>
          <Text style={{ fontSize: 16 }}>{hasCheckedIn ? "🔥" : "🕯️"}</Text>
          <Text style={{ fontFamily: undefined, fontSize: 15, fontWeight: "900", color: "#9a5d12" }}>{days}</Text>
          <Text style={{ fontSize: 7, fontWeight: "900", color: "#9a5d12", alignSelf: "flex-end", marginBottom: 9 }}>天</Text>
        </Pressable>
      </View>
      <LinearGradient colors={["#4c43c5", "#7168ef"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeCard}>
        <Text style={{ position: "absolute", top: 18, right: 120, color: "rgba(255,255,255,.55)" }}>★</Text>
        <Text style={{ position: "absolute", top: 40, right: 20, fontSize: 12, color: "rgba(255,255,255,.55)" }}>✦</Text>
        <View style={{ zIndex: 2 }}>
          <Text style={{ color: "#d9d6ff", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 }}>TODAY'S ADVENTURE</Text>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", lineHeight: 30, marginVertical: 12 }}>今天也要勇敢{"\n"}开口说英语！</Text>
          <Pressable onPress={() => onNavigate("learn")} style={styles.welcomeButton}><Text style={{ color: P.violetDeep, fontSize: 11, fontWeight: "900" }}>继续学习 →</Text></Pressable>
        </View>
        <View style={styles.mascotSpot}>
          <LumiMascot size="large" />
          <View style={styles.speechDot}><Text style={{ color: P.violet, fontSize: 12, fontWeight: "900" }}>Hi!</Text></View>
        </View>
      </LinearGradient>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 11, marginTop: 13 }}>
        <View style={styles.ring}><Text style={{ fontSize: 17, fontWeight: "900", color: P.violetDeep }}>3</Text><Text style={{ fontSize: 9, color: P.muted }}>/5</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: "900", color: P.ink }}>今日任务 · 还剩 2 项小挑战</Text>
          <Text style={{ fontSize: 9, color: P.muted, marginVertical: 5 }}>预计 14 分钟 · 完成就能打开星星宝箱</Text>
          <ProgressBar value={60} tone="mint" />
        </View>
        <Pressable onPress={() => onNavigate("learn")}><Text style={{ color: P.violet, fontWeight: "900", fontSize: 10 }}>继续 ›</Text></Pressable>
      </Card>
      <SectionTitle eyebrow="COURSE RESOURCES" title="甲方课程资源" action="全部教材 →" onAction={() => setShowLibrary(true)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
        {homeBooks.map((book, index) => (
          <View key={book.title} style={styles.courseCard}>
            <BookCover cover={book.cover} compact />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 8, color: index === 0 ? P.coral : P.muted, fontWeight: "800" }}>{index === 0 ? "当前主教材" : book.series}</Text>
              <Text style={{ fontSize: 13, fontWeight: "900", color: P.ink }}>{book.title}</Text>
              <Text style={{ fontSize: 8, color: P.muted }}>{book.grade} · {book.currentUnit}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                <View style={{ flex: 1 }}><ProgressBar value={book.progress} /></View>
                <Text style={{ fontSize: 8, color: P.violetDeep, fontWeight: "900" }}>{book.progress}%</Text>
              </View>
              <Pressable onPress={() => onNavigate("learn")} style={styles.courseOpenBtn}>
                <Text style={{ color: P.violet, fontSize: 9, fontWeight: "900" }}>{index === 0 ? "继续学习" : "打开教材"} →</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.hintDots}>
        <View style={[styles.dot, { backgroundColor: P.violet }]} /><View style={styles.dot} /><View style={styles.dot} />
        <Text style={{ fontSize: 7, color: "#a1a7b5" }}> 左右滑动查看更多</Text>
      </View>
    </StudentPage>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 14, paddingBottom: 16 },
  avatarTile: { width: 54, height: 54, borderRadius: 18, backgroundColor: P.violetSoft, alignItems: "center", justifyContent: "center" },
  checkinButton: { minWidth: 67, height: 39, flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1, borderColor: "#ffd988", borderRadius: 14, paddingHorizontal: 8, backgroundColor: "#fff3cf", justifyContent: "center" },
  welcomeCard: { minHeight: 185, overflow: "hidden", borderRadius: 26, padding: 22 },
  welcomeButton: { minHeight: 38, borderRadius: 12, paddingHorizontal: 13, justifyContent: "center", alignSelf: "flex-start", backgroundColor: P.sun },
  mascotSpot: { position: "absolute", right: 16, bottom: -4, transform: [{ scale: 0.78 }], transformOrigin: "bottom right" },
  speechDot: { position: "absolute", top: -26, right: -8, width: 42, height: 34, borderRadius: 16, borderBottomLeftRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  ring: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#e9edf3", alignItems: "baseline", justifyContent: "center", paddingTop: 13, flexDirection: "row", shadowColor: P.mint, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  courseCard: { width: 292, flexDirection: "row", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 21, borderWidth: 1, borderColor: "#eef0f6" },
  courseOpenBtn: { alignSelf: "flex-start", marginTop: 2 },
  hintDots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#d9dcE5" },
  weekday: { width: `${100 / 7}%`, textAlign: "center", fontSize: 8, color: P.muted, marginBottom: 4 },
  dayCell: { width: `${100 / 7}%`, height: 34, alignItems: "center", justifyContent: "center" },
  dayInner: { width: 30, height: 28, marginHorizontal: "auto", borderRadius: 10, flexDirection: "row", gap: 2, alignItems: "center", justifyContent: "center" },
  dayChecked: { backgroundColor: "#fff3c8" },
  dayToday: { borderWidth: 2, borderColor: P.violet },
  filterHeading: { color: P.muted, fontSize: 9, fontWeight: "800" },
  gradeChip: { minHeight: 30, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#f0f2f6" },
  seriesTab: { minHeight: 32, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: "#e2e4ec", backgroundColor: "#fff" },
  libraryBook: { width: "48.5%", borderRadius: 20, borderWidth: 1, borderColor: "#eef0f6", backgroundColor: "#fff", padding: 10 },
});
