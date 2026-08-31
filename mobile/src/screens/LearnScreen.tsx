/** 学习页复刻（原 LearnPage 三态：冒险地图 → 课程目录 → 播放器 → 完成页），数据接嘟噜噜 10 节假课程 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Card, LumiMascot, PageHeader, P, Pill, ProgressBar, SectionTitle, StudentPage, type StudentTab } from "@/components/ui";
import { LessonActivityView, LessonComplete, LessonCourseCard, activityCatalog, detailOf } from "@/components/learning";
import { COURSE_INTRO, COURSE_TITLE, LESSONS, lessonEmoji } from "@/data/mock";

type View_ = "home" | "catalog" | "player" | "complete";
const ROUTE_POINTS = [
  { x: 22, y: 14 }, { x: 56, y: 22 }, { x: 24, y: 36 }, { x: 60, y: 47 }, { x: 26, y: 60 }, { x: 62, y: 71 }, { x: 45, y: 85 },
];
const shortTitle = (title: string) => title.replace(/^第\d+节[:：]?/, "").trim();

export default function LearnScreen({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [view, setView] = useState<View_>("home");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});

  const section = LESSONS[Math.min(sectionIndex, LESSONS.length - 1)];
  const startAt = (index: number, sectionIdx = sectionIndex) => {
    setSectionIndex(sectionIdx);
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
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  if (view === "complete") {
    return (
      <StudentPage active="learn" onNavigate={onNavigate}>
        <LessonComplete correct={passedCount} total={Math.max(1, totalCount)} lessonTitle={section.title}
          onRestart={() => startAt(sessionStart, sectionIndex)} onHome={() => setView("home")} />
      </StudentPage>
    );
  }

  if (view === "catalog") {
    const types = new Set(section.activities.map((activity) => activity.type)).size;
    return (
      <StudentPage active="learn" onNavigate={onNavigate}>
        <PageHeader eyebrow="TODAY'S ADVENTURE" title={shortTitle(section.title)} subtitle={`${COURSE_TITLE} · 和 Lumi 一路学到会`} trailing={<Pill tone="yellow">⭐ +{section.activities.length}</Pill>} onBack={() => setView("home")} />
        <LessonCourseCard title={shortTitle(section.title)} intro={COURSE_INTRO} count={section.activities.length} typeCount={types}
          emoji={lessonEmoji(sectionIndex)} onStart={() => startAt(0)} startLabel={`和 Lumi 学「${shortTitle(section.title)}」`} />
        <SectionTitle eyebrow="ADVENTURE ROUTE" title="这一节的小挑战" />
        <View style={{ gap: 8 }}>
          {section.activities.map((activity, index) => {
            const meta = activityCatalog.find((item) => item.type === activity.type) ?? activityCatalog[0];
            const soft = { violet: P.violetSoft, mint: "#dff8f3", sky: "#def3ff", yellow: "#fff3c8", pink: "#ffe5ea" }[meta.tone];
            return (
              <Pressable key={`${activity.type}-${index}`} onPress={() => startAt(index)} style={styles.schemaRow}>
                <View style={[styles.schemaIcon, { backgroundColor: soft }]}><Text style={{ color: P.violetDeep, fontSize: 12, fontWeight: "900" }}>{meta.icon}</Text></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: P.ink }}>{index + 1}. {meta.studentTitle}</Text>
                  <Text style={{ fontSize: 9, color: P.muted }}>{detailOf(activity)}</Text>
                </View>
                <Text style={{ color: P.muted, fontSize: 9 }}>出发 ›</Text>
              </Pressable>
            );
          })}
        </View>
        <Card tone="sky" style={{ flexDirection: "row", gap: 9, marginTop: 13 }}>
          <Text style={{ fontSize: 20 }}>🦌</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: P.ink }}>Lumi 会一直陪着你</Text>
            <Text style={{ fontSize: 9, color: P.muted, lineHeight: 13, marginTop: 4 }}>每完成一个小挑战，就会离宝箱更近一点。</Text>
          </View>
        </Card>
      </StudentPage>
    );
  }

  if (view === "player") {
    const activity = section.activities[step];
    return (
      <StudentPage active="learn" onNavigate={onNavigate} hideNav>
        <View style={styles.focusHeader}>
          <Pressable onPress={() => setView("catalog")} accessibilityLabel="退出当前课程" style={styles.focusClose}><Text style={{ color: "#8e93a4", fontSize: 18 }}>×</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: P.violet, fontSize: 7, fontWeight: "900", letterSpacing: 1.2 }}>LUMI ADVENTURE</Text>
            <Text style={{ fontSize: 12, fontWeight: "900", color: P.ink }}>{shortTitle(section.title)}</Text>
          </View>
          <Pill tone="yellow">⭐ {passedCount * 5 + 100}</Pill>
        </View>
        <LessonActivityView
          key={`${sectionIndex}-${step}`}
          activity={activity}
          step={step}
          total={section.activities.length}
          lessonTitle={shortTitle(section.title)}
          onCompleted={(correct) => setResults((items) => ({ ...items, [step]: correct }))}
          onNext={finishStep}
          onPrevious={() => setStep((value) => Math.max(sessionStart, value - 1))}
          canPrevious={step > sessionStart}
        />
      </StudentPage>
    );
  }

  /* ---- 学习主页：当前教材卡 + 冒险地图 ---- */
  return (
    <StudentPage active="learn" onNavigate={onNavigate}>
      <PageHeader eyebrow="MY STORY JOURNEY" title="学习冒险" subtitle={`${COURSE_TITLE.split("英语")[0]}英语 · ${LESSONS.length} 个小单元`} trailing={<Pill tone="yellow">⭐ 126</Pill>} />
      <Card style={{ flexDirection: "row", gap: 12 }}>
        <LinearGradient colors={["#dedaff", "#c7c0ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 84, height: 84, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ position: "absolute", left: 7, top: 5, fontSize: 8, fontWeight: "900", color: "rgba(49,43,131,.45)" }}>LUMI</Text>
          <Text style={{ fontSize: 30 }}>{lessonEmoji(0)}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: P.violet, fontSize: 8, fontWeight: "900", letterSpacing: 1 }}>当前课程 · 启蒙系列</Text>
          <Text style={{ fontSize: 15, fontWeight: "900", color: P.ink }}>{COURSE_TITLE}</Text>
          <Text style={{ fontSize: 9, color: P.muted }} numberOfLines={2}>{COURSE_INTRO}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ flex: 1 }}><ProgressBar value={10} /></View>
            <Text style={{ fontSize: 9, fontWeight: "900", color: P.violetDeep }}>10%</Text>
          </View>
          <Button variant="secondary" style={{ minHeight: 34 }} onPress={() => { setSectionIndex(0); setView("catalog"); }}>进入第 1 节 · 打招呼</Button>
        </View>
      </Card>
      <SectionTitle eyebrow="DUDULU TOWN" title={`${LESSONS.length} 小节冒险地图`} />
      <LinearGradient colors={["#fbfaff", "#f3f1ff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.mapStage}>
        {ROUTE_POINTS.map((point, index) => {
          const status = index < 3 ? "done" : index === 3 ? "current" : "todo";
          return (
            <View key={index} style={[styles.mapNode, { left: `${point.x}%`, top: `${point.y}%` }]}>
              <Pressable disabled={false} onPress={() => { setSectionIndex(Math.min(index, LESSONS.length - 1)); setView("catalog"); }}
                accessibilityLabel={`打开 ${LESSONS[index].title}`}
                style={[styles.mapButton,
                  status === "current" && { borderColor: P.violet, borderWidth: 3, backgroundColor: P.violet },
                  status === "done" && { borderColor: P.mint, backgroundColor: P.mint },
                ]}>
                <Text style={{ color: status === "current" || status === "done" ? "#fff" : P.violet, fontSize: 11, fontWeight: "900" }}>
                  {status === "done" ? "✓" : index + 1}
                </Text>
              </Pressable>
              <Text style={styles.mapEmoji}>{lessonEmoji(index)}</Text>
            </View>
          );
        })}
        <View style={{ position: "absolute", right: 10, bottom: 6 }}>
          <LumiMascot size="small" mood="happy" />
        </View>
      </LinearGradient>
      <SectionTitle eyebrow="ALL LESSONS" title="全部小节" />
      <View style={{ gap: 10 }}>
        {LESSONS.map((lesson, index) => (
          <Card key={lesson.id} style={{ flexDirection: "row", alignItems: "center", gap: 11, minHeight: 74, padding: 12 }}>
            <View style={[styles.lessonIcon, { backgroundColor: ["#fff3c8", "#dff8f3", "#def3ff", "#ffe5ea", P.violetSoft][index % 5] }]}>
              <Text style={{ fontSize: 18 }}>{lessonEmoji(index)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: P.ink }}>{lesson.title}</Text>
              <Text style={{ fontSize: 8, color: P.muted, marginTop: 2 }}>{lesson.activities.length} 个小挑战</Text>
            </View>
            <Pressable onPress={() => { setSectionIndex(index); setView("catalog"); }}>
              <Text style={{ color: P.violet, fontSize: 9, fontWeight: "900" }}>出发 ›</Text>
            </Pressable>
          </Card>
        ))}
      </View>
    </StudentPage>
  );
}

const styles = StyleSheet.create({
  focusHeader: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: P.line, paddingHorizontal: 14, paddingTop: 7, paddingBottom: 7, marginHorizontal: -18, backgroundColor: "rgba(255,255,255,.94)" },
  focusClose: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: "#e4e2ef", alignItems: "center", justifyContent: "center", backgroundColor: "#f8f7fc" },
  schemaRow: { minHeight: 59, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: P.line, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 11, backgroundColor: "#fff" },
  schemaIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mapStage: { height: 320, borderRadius: 21, borderWidth: 1, borderColor: "#e5e1ff", position: "relative", marginBottom: 14 },
  mapNode: { position: "absolute", alignItems: "center", width: 44, marginLeft: -22 },
  mapButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#d9d5fb", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#2b3151", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  mapEmoji: { fontSize: 13, marginTop: 2 },
  lessonIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
