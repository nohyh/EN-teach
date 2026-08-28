/**
 * 学习交互复刻层：对应队友分支 components/learning-components.tsx。
 * 五种组件视图、旅程条、Lumi 引导气泡、正误反馈和完成庆祝页。
 * 数据不再来自 sampleLesson，而由调用方传入 LESSONS 分节后的活动。
 */
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextStyle, DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Card, LumiMascot, Pill, P, ProgressBar } from "./ui";
import { playLumiSound, speak } from "@/services/tts";
import type { Activity, RecallMode, WordComponent, SentenceComponent, RecallComponent, PronunciationComponent, DialogComponent } from "@/types/lesson";

export type WordA = WordComponent;
export type SentenceA = SentenceComponent;
export type RecallA = RecallComponent;
export type PronunciationA = PronunciationComponent;
export type DialogA = DialogComponent;

type Tone = "violet" | "mint" | "sky" | "yellow" | "pink";

export const activityCatalog: Array<{ type: Activity["type"]; icon: string; studentTitle: string; studentDescription: string; tone: Tone }> = [
  { type: "word", icon: "Aa", studentTitle: "认识水果朋友", studentDescription: "先收集今天的新单词", tone: "yellow" },
  { type: "sentence", icon: "句", studentTitle: "神奇句子袋", studentDescription: "学会一句有用的话", tone: "sky" },
  { type: "recall", icon: "想", studentTitle: "记忆小挑战", studentDescription: "听一听、想一想、填一填", tone: "violet" },
  { type: "pronunciation", icon: "说", studentTitle: "勇敢开口读", studentDescription: "跟着 Lumi 大声说", tone: "pink" },
  { type: "dialog", icon: "聊", studentTitle: "水果店大冒险", studentDescription: "把学过的英语用起来", tone: "mint" },
];

export function catalogMeta(type: Activity["type"]) {
  return activityCatalog.find((item) => item.type === type) ?? activityCatalog[0];
}

export function detailOf(activity: Activity): string {
  switch (activity.type) {
    case "word": return `认识 ${activity.word}`;
    case "sentence": return `学会说：${activity.sentence}`;
    case "pronunciation": return `勇敢读出 ${activity.content}`;
    case "dialog": return `在${activity.scene}完成英语对话`;
    case "recall":
      if (activity.mode === "audio_to_text") return "听声音，找到藏起来的句子";
      if (activity.mode === "fill_blank") return "补好水果店的句子招牌";
      return "想一想，把苹果卡片找出来";
  }
}

const STORY_BEATS = [
  { place: "果园入口", title: "发现一颗红苹果", promise: "把水果朋友装进小篮子" },
  { place: "苹果树下", title: "认出水果卡片", promise: "答对就能拿到第一颗水果" },
  { place: "果园小路", title: "叫出它的英文名", promise: "Lumi 正在前面等你" },
  { place: "小木桥", title: "让苹果听见你的声音", promise: "勇敢开口就能过桥" },
  { place: "水果车旁", title: "学会喜欢的表达", promise: "带着神奇句子继续出发" },
  { place: "商店门口", title: "补好水果店招牌", promise: "填对就能推开店门" },
  { place: "水果店里", title: "听懂店员的话", promise: "最后一步就要开始对话啦" },
  { place: "收银台前", title: "和店员说英语", promise: "完成对话，打开星星宝箱" },
];

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/[.,!?;:'"()[\]{}，。！？；：“”‘’]/g, " ").replace(/\s+/g, " ").trim();
}

/* ---- 旅程条 ---- */
export function LessonJourney({ step, total, title }: { step: number; total: number; title: string }) {
  const percent = Math.max(6, Math.min(100, ((step + 1) / total) * 100));
  const chapter = step < 3 ? "在果园收集水果" : step < 6 ? "带着水果去商店" : "在水果店完成挑战";
  const beat = STORY_BEATS[Math.min(step, STORY_BEATS.length - 1)];
  return (
    <LinearGradient colors={["#faf9ff", "#f0edff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.journey}>
      <View style={[styles.journeyCopy, { position: "relative" }]}>
        <Text style={{ color: P.violet, fontSize: 7, fontWeight: "900", letterSpacing: 1 }}>{title}</Text>
        <Text style={{ color: P.violetDeep, fontSize: 11, fontWeight: "900" }}>{chapter}</Text>
        <Text style={[styles.journeyPromise]}>{beat.promise}</Text>
      </View>
      <View style={styles.journeyTrack}>
        <View style={[styles.journeyFill, { width: `${percent}%` }]} />
        <Text style={[styles.journeyStop, { left: -7 }]}>🌳</Text>
        <Text style={[styles.journeyStop, { left: "50%", marginLeft: -10 }]}>🛤</Text>
        <Text style={[styles.journeyStop, { right: -7 }]}>🏪</Text>
        <Text style={[styles.journeyRunner, { left: `${Math.max(1, Math.min(96, percent - 6))}%` }]}>🦌</Text>
      </View>
    </LinearGradient>
  );
}

/* ---- 活动容器：Lumi 引导 + 内容 ---- */
function ActivityFrame({ activity, step, title, children }: { activity: Activity; step: number; title: string; children: ReactNode }) {
  const message = activity.type === "dialog" ? "把刚学会的表达，用到小对话里吧！" : activity.message;
  const story = STORY_BEATS[Math.min(step, STORY_BEATS.length - 1)];
  const guideMood = activity.type === "pronunciation" ? ("listening" as const) : activity.type === "recall" || activity.type === "dialog" ? ("curious" as const) : ("neutral" as const);
  return (
    <Card style={{ flex: 1, padding: 0, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, paddingTop: 10 }}>
        <LumiMascot size="small" mood={guideMood} />
        <View style={{ flex: 1 }}>
          <Text><Text style={{ color: P.violet, fontSize: 7, fontWeight: "900", letterSpacing: 1 }}>{story.place}</Text><Text style={{ fontSize: 10, fontWeight: "900", color: P.ink }}> · {story.title}</Text></Text>
          <View style={{ backgroundColor: P.violetSoft, borderRadius: 12, borderTopLeftRadius: 4, paddingVertical: 7, paddingHorizontal: 9, marginTop: 2 }}>
            <Text style={{ color: "#625c98", fontSize: 9, lineHeight: 14, fontWeight: "600" }}>{message}</Text>
          </View>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>{children}</View>
    </Card>
  );
}

/** 绝对定位的小装饰（星星/纸屑）通用描述 */
type Spot = { c: string; ch: string; l?: DimensionValue; r?: DimensionValue; t?: DimensionValue; b?: DimensionValue };

function spotStyle(spot: Spot, fontSize: number): TextStyle {
  const style: TextStyle = { position: "absolute", color: spot.c, fontWeight: "900", fontSize };
  if (spot.l != null) style.left = spot.l;
  if (spot.r != null) style.right = spot.r;
  if (spot.t != null) style.top = spot.t;
  if (spot.b != null) style.bottom = spot.b;
  return style;
}

/* ---- 反馈 / 支持面板 ---- */
export function FeedbackPanel({ kind, title, text }: { kind: "correct" | "wrong"; title: string; text: string }) {
  const correct = kind === "correct";
  const burst: Spot[] = correct
    ? [{ l: "4%", t: "6%", c: P.sun, ch: "★" }, { r: "7%", t: "3%", c: P.violet, ch: "✦" }, { r: "3%", b: "4%", c: P.mint, ch: "●" }, { l: "18%", b: "0%", c: P.sun, ch: "★" }]
    : [{ l: "4%", t: "6%", c: "#f3b84c", ch: "★" }, { r: "7%", t: "3%", c: "#f3b84c", ch: "✦" }, { r: "3%", b: "4%", c: "#f3b84c", ch: "●" }, { l: "18%", b: "0%", c: "#f3b84c", ch: "★" }];
  return (
    <LinearGradient
      colors={correct ? ["#ccf6ed", "#f6fffc", "#d9faf3"] : ["#fff0d8", "#fffaf1"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.feedback, { borderWidth: 2, borderColor: correct ? "#79ddca" : "#f1be68", backgroundColor: "transparent" }]}
    >
      {burst.map((item, index) => (
        <Text key={index} style={spotStyle(item, correct ? 17 : 12)}>{item.ch}</Text>
      ))}
      <LumiMascot size="medium" mood={correct ? "happy" : "encourage"} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 8, fontWeight: "900", letterSpacing: 1, color: correct ? "#12806b" : "#b97b2e" }}>{correct ? "太棒啦！" : "Lumi 陪你再试试"}</Text>
        <Text style={{ fontSize: 13, fontWeight: "900", color: correct ? "#0f7565" : "#8f501a" }}>{title}</Text>
        <Text style={{ fontSize: 9, fontWeight: "600", lineHeight: 14, color: correct ? "#28695b" : "#96631f" }}>{text}</Text>
      </View>
    </LinearGradient>
  );
}

/* ---- 底部双按钮坞 ---- */
function ActivityActionDock({ primaryLabel, onPrimary, primaryDisabled = false, onPrevious, canPrevious }: { primaryLabel: string; onPrimary?: () => void; primaryDisabled?: boolean; onPrevious: () => void; canPrevious: boolean }) {
  return (
    <View style={styles.dock}>
      <View style={{ flex: 0.82 }}><Button variant="secondary" disabled={!canPrevious} onPress={onPrevious}>← 回到上一步</Button></View>
      <View style={{ flex: 1.35 }}><Button disabled={primaryDisabled} onPress={onPrimary}>{primaryLabel}</Button></View>
    </View>
  );
}

/* ---- 发音按钮 ---- */
export function AudioButton({ text, label = "听标准发音" }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <Pressable
      onPress={() => speak(text, setPlaying)}
      accessibilityLabel={`${label}：${text}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 7, minHeight: 42, borderRadius: 14, paddingHorizontal: 13, alignSelf: "center", backgroundColor: playing ? "#ffe8ec" : P.violetSoft }}
    >
      <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: playing ? P.coral : P.violet }}>
        <Text style={{ color: "#fff", fontSize: 9 }}>{playing ? "◼" : "▶"}</Text>
      </View>
      <Text style={{ color: playing ? "#d9586d" : P.violet, fontSize: 10, fontWeight: "900" }}>{playing ? "正在播放" : label}</Text>
    </Pressable>
  );
}

/* ---- 五种组件视图 ---- */
function WordView({ activity, onNext, onPrevious, canPrevious }: { activity: WordA; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const next = () => { playLumiSound("correct"); onNext(); };
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.centerCol, { flex: 1 }]}>
        <Text style={styles.kicker}>今天的新朋友</Text>
        <Text style={styles.bigWord}>{activity.word}</Text>
        <Text style={styles.meaning}>{activity.meaning}</Text>
        <AudioButton text={activity.word} />
        <View style={styles.exampleCard}>
          <Text style={styles.exampleKicker}>放进一句话里</Text>
          <Text style={{ fontSize: 14, fontWeight: "800", color: P.ink }}>{activity.example}</Text>
          <Text style={{ fontSize: 9, color: P.muted }}>{activity.exampleMeaning}</Text>
        </View>
      </View>
      <ActivityActionDock primaryLabel="收进水果篮 →" onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} />
    </View>
  );
}

function SentenceView({ activity, onNext, onPrevious, canPrevious }: { activity: SentenceA; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const next = () => { playLumiSound("correct"); onNext(); };
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.centerCol, { flex: 1 }]}>
        <Text style={styles.kicker}>今天的神奇句子</Text>
        <Text style={styles.bigSentence}>{activity.sentence}</Text>
        <Text style={styles.meaning}>{activity.meaning}</Text>
        <AudioButton text={activity.sentence} label="听一听整句话" />
        <View style={styles.patternRow}>
          <View style={styles.patternBox}><Text style={{ color: P.violet, fontSize: 9, fontWeight: "800" }}>I like</Text></View>
          <Text style={{ color: P.muted }}>＋</Text>
          <View style={styles.patternBox}><Text style={{ color: P.violet, fontSize: 9, fontWeight: "800" }}>喜欢的事物</Text></View>
        </View>
      </View>
      <ActivityActionDock primaryLabel="带上这句话 →" onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} />
    </View>
  );
}

function RecallView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: RecallA; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const isAudio = activity.mode === "audio_to_text";
  const finished = result === "correct" || attempts >= 3;

  const submit = useCallback(() => {
    if (!answer.trim()) return;
    const correct = normalize(answer) === normalize(activity.answer);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setResult(correct ? "correct" : "wrong");
    playLumiSound(correct ? "correct" : "retry");
    if (correct || nextAttempts >= 3) onCompleted(correct);
  }, [answer, activity.answer, attempts, onCompleted]);

  const wrongHint = attempts === 1
    ? isAudio ? "再听一次，注意每一个词。" : `小提示：答案有 ${activity.answer.replace(/\s/g, "").length} 个字符。`
    : attempts === 2
      ? `再给一个提示：答案从“${activity.answer.slice(0, 1)}”开始。`
      : `一起记住它：${activity.answer}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {isAudio ? (
          <View style={styles.dictationPrompt}>
            <AudioButton text={activity.prompt} label="点击听题" />
            <Text style={{ color: P.muted, fontSize: 9 }}>题目藏在声音里，仔细听哦</Text>
          </View>
        ) : (
          <View style={styles.recallPrompt}><Text style={{ fontSize: 23, fontWeight: "900", color: P.violetDeep, textAlign: "center", lineHeight: 32 }}>{activity.prompt}</Text></View>
        )}
        <View style={{ marginTop: 12, gap: 6 }}>
          <Text style={{ color: "#5b6376", fontSize: 9, fontWeight: "900" }}>我的答案</Text>
          <TextInput
            value={answer}
            editable={result !== "correct"}
            onChangeText={setAnswer}
            onSubmitEditing={() => { if (!finished) submit(); }}
            placeholder="在这里输入答案"
            placeholderTextColor="#9aa1b2"
            autoCapitalize="none"
            style={styles.textInput}
          />
        </View>
        {result === "correct" ? (
          <FeedbackPanel kind="correct" title="苹果装进篮子啦！" text="你找到了答案，Lumi 开心地跳起来啦！" />
        ) : result === "wrong" ? (
          <FeedbackPanel kind="wrong" title={attempts >= 3 ? "没关系，我们一起记住" : "差一点点，继续试试看"} text={wrongHint} />
        ) : null}
      </View>
      <ActivityActionDock
        primaryLabel={finished ? "继续赶路 →" : attempts ? "再检查一次" : "检查答案"}
        primaryDisabled={!finished && !answer.trim()}
        onPrimary={() => { finished ? onNext() : submit(); }}
        onPrevious={onPrevious}
        canPrevious={canPrevious}
      />
    </View>
  );
}

function PronunciationView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: PronunciationA; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const complete = () => { setState("done"); playLumiSound("correct"); onCompleted(true); };
  const primary = state === "idle" ? () => setState("recording") : state === "recording" ? complete : onNext;
  const bars = [15, 27, 39, 52, 39, 27, 15];
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.centerCol, { flex: 1 }]}>
        <Text style={styles.bigWord}>{activity.content}</Text>
        <Text style={styles.meaning}>{activity.meaning}</Text>
        <AudioButton text={activity.content} />
        <View style={styles.recordingRow} accessibilityElementsHidden>
          {bars.map((barHeight, index) => (
            <View key={index} style={{ width: 5, height: state === "recording" ? barHeight : Math.round(barHeight * 0.55), borderRadius: 99, backgroundColor: state === "recording" ? P.coral : "#d8d5f5" }} />
          ))}
        </View>
        {state === "done" && <FeedbackPanel kind="correct" title="声音飞过小木桥啦！" text="Lumi 听见你勇敢地开口了。" />}
      </View>
      <ActivityActionDock
        primaryLabel={state === "idle" ? "🎙 开始跟读" : state === "recording" ? "■ 完成录音" : "继续去水果店 →"}
        onPrimary={primary}
        onPrevious={onPrevious}
        canPrevious={canPrevious}
      />
    </View>
  );
}

function DialogView({ activity, onCompleted, onNext, onPrevious, canPrevious, isLast }: { activity: DialogA; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean; isLast: boolean }) {
  const [messages, setMessages] = useState<Array<{ role: "ai" | "student"; text: string }>>([{ role: "ai", text: activity.opening }]);
  const [input, setInput] = useState("");
  const [sent, setSent] = useState(false);
  const replies = ["I like apples.", "I like bananas."];
  const chatRef = useRef<ScrollView>(null);

  useEffect(() => { chatRef.current?.scrollToEnd({ animated: true }); }, [messages]);

  const send = () => {
    const value = input.trim();
    if (!value || sent) return;
    setMessages((items) => [...items, { role: "student", text: value }, { role: "ai", text: "Great! That sounds delicious. Me too!" }]);
    setSent(true);
    playLumiSound("correct");
    onCompleted(true);
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View style={styles.dialogScene}>
          <Text style={{ color: "#147867", fontSize: 7, fontWeight: "900", letterSpacing: 1 }}>你已经走进</Text>
          <Text style={{ color: "#147867", fontSize: 13, fontWeight: "900" }}>🍎 {activity.scene}</Text>
          <Text style={{ color: "#3d8577", fontSize: 8, lineHeight: 12 }}>试着告诉店员：你喜欢什么水果？</Text>
        </View>
        <ScrollView ref={chatRef} style={{ maxHeight: 140, marginVertical: 9 }} contentContainerStyle={{ gap: 8 }}>
          {messages.map((message, index) => (
            <View key={`${message.role}-${index}`} style={[styles.chatBubble, message.role === "student" && styles.chatBubbleStudent]}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: message.role === "student" ? "#fff" : P.ink, lineHeight: 15 }}>{message.text}</Text>
            </View>
          ))}
        </ScrollView>
        {!sent ? (
          <>
            <View style={styles.dialogReplies}>
              {replies.map((reply) => (
                <Pressable key={reply} onPress={() => setInput(reply)}
                  style={{ minHeight: 32, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: input === reply ? P.violet : "#dedaff", backgroundColor: input === reply ? P.violet : "#fff" }}>
                  <Text style={{ color: input === reply ? "#fff" : P.violet, fontSize: 9, fontWeight: "800" }}>{reply}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={input} onChangeText={setInput} onSubmitEditing={send} placeholder="试着用英语回答" placeholderTextColor="#9aa1b2" autoCapitalize="none" style={[styles.textInput, { width: "100%" }]} />
          </>
        ) : (
          <FeedbackPanel kind="correct" title="店员听懂你啦！" text="你用刚学会的句子完成了水果店对话。" />
        )}
      </View>
      <ActivityActionDock
        primaryLabel={sent ? (isLast ? "打开星星宝箱 ★" : "继续冒险 →") : "发送回答 ↑"}
        primaryDisabled={!sent && !input.trim()}
        onPrimary={sent ? onNext : send}
        onPrevious={onPrevious}
        canPrevious={canPrevious}
      />
    </View>
  );
}

/* ---- 分发器 ---- */
export function LessonActivityView({ activity, step, total, lessonTitle, onCompleted, onNext, onPrevious, canPrevious }: {
  activity: Activity; step: number; total: number; lessonTitle: string;
  onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean;
}) {
  const completeAndNext = () => { onCompleted(true); onNext(); };
  return (
    <View style={{ flex: 1, gap: 9 }}>
      <LessonJourney step={step} total={total} title={lessonTitle} />
      <ActivityFrame activity={activity} step={step} title={lessonTitle}>
        {activity.type === "word" ? <WordView activity={activity} onNext={completeAndNext} onPrevious={onPrevious} canPrevious={canPrevious} />
          : activity.type === "sentence" ? <SentenceView activity={activity} onNext={completeAndNext} onPrevious={onPrevious} canPrevious={canPrevious} />
          : activity.type === "recall" ? <RecallView activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} />
          : activity.type === "pronunciation" ? <PronunciationView activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} />
          : <DialogView activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} isLast={step === total - 1} />}
      </ActivityFrame>
    </View>
  );
}

/* ---- 课程卡 & 完成页 ---- */
export function LessonCourseCard({ title, intro, count, typeCount, emoji = "🍎", onStart, startLabel = "和 Lumi 出发" }: { title: string; intro: string; count: number; typeCount: number; emoji?: string; onStart: () => void; startLabel?: string }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <LinearGradient colors={["#eeecff", "#dcd8ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 72, minHeight: 112, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ position: "absolute", left: 8, top: 7, opacity: 0.45, fontSize: 9, fontWeight: "900", color: P.violetDeep }}>abc</Text>
          <Text style={{ fontSize: 38 }}>{emoji}</Text>
        </LinearGradient>
        <View style={{ flex: 1, gap: 5 }}>
          <Pill tone="mint">今日冒险</Pill>
          <Text style={{ fontSize: 15, fontWeight: "900", color: P.ink }}>{title}</Text>
          <Text style={{ color: P.muted, fontSize: 9, lineHeight: 13 }}>{intro}</Text>
          <Text style={{ color: "#969daf", fontSize: 8, marginTop: 4 }}>{count} 个小挑战 · {typeCount} 种玩法 · 约 {Math.max(3, Math.round(count * 1.5))} 分钟</Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}><Button onPress={onStart}>{startLabel}</Button></View>
    </Card>
  );
}

export function LessonComplete({ correct, total, lessonTitle, onRestart, onHome }: { correct: number; total: number; lessonTitle: string; onRestart: () => void; onHome: () => void }) {
  useEffect(() => { playLumiSound("complete"); }, []);
  const confetti: Spot[] = [
    { l: "8%", t: "10%", c: P.sun, ch: "★" }, { l: "24%", t: "38%", c: P.violet, ch: "✦" }, { l: "11%", t: "66%", c: P.mint, ch: "●" },
    { r: "8%", t: "12%", c: P.sun, ch: "★" }, { r: "24%", t: "40%", c: P.violet, ch: "✦" }, { r: "12%", t: "68%", c: P.mint, ch: "●" },
  ];
  const short = lessonTitle.replace(/^第\d+节[:：]?/, "").trim();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", position: "relative", paddingVertical: 25 }}>
      <View pointerEvents="none" style={{ position: "absolute", top: 40, left: 14, right: 14, height: 240 }}>
        {confetti.map((item, index) => (
          <Text key={index} style={spotStyle(item, 16)}>{item.ch}</Text>
        ))}
      </View>
      <Text style={{ color: P.sun, fontSize: 20, letterSpacing: 6 }}>★ ✦ ★</Text>
      <View style={{ alignItems: "center", gap: 10, marginVertical: 18 }}>
        <LumiMascot size="large" mood="proud" />
        <Pill tone="yellow">冒险小英雄</Pill>
      </View>
      <Text style={styles.kicker}>ADVENTURE COMPLETE</Text>
      <Text style={{ fontSize: 21, fontWeight: "900", color: P.ink, marginTop: 8, textAlign: "center" }}>你闯过了「{short}」！</Text>
      <Text style={{ color: P.muted, fontSize: 10, lineHeight: 16, textAlign: "center", maxWidth: 300, marginTop: 6 }}>Lumi 想抱抱你：愿意尝试、愿意开口，就是今天最棒的收获。</Text>
      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch", marginVertical: 20 }}>
        {[{ v: total, s: "走过的小站" }, { v: correct, s: "收集的星星" }, { v: "★", s: "勇气贴纸" }].map((stat) => (
          <View key={stat.s} style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: P.line, borderRadius: 17, padding: 13, alignItems: "center", gap: 4 }}>
            <Text style={{ color: P.violetDeep, fontSize: 19, fontWeight: "900" }}>{stat.v}</Text>
            <Text style={{ color: P.muted, fontSize: 7 }}>{stat.s}</Text>
          </View>
        ))}
      </View>
      <View style={{ alignSelf: "stretch", gap: 9 }}>
        <Button onPress={onRestart}>和 Lumi 再玩一次</Button>
        <Button variant="secondary" onPress={onHome}>带着星星回乐园</Button>
      </View>
    </View>
  );
}

export function progressValue(step: number, total: number) {
  return Math.max(6, Math.min(100, ((step + 1) / total) * 100));
}

export { ProgressBar };

const styles = StyleSheet.create({
  centerCol: { alignItems: "center", justifyContent: "center", gap: 4 },
  kicker: { color: P.violet, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  bigWord: { fontSize: 45, fontWeight: "900", color: P.violetDeep, lineHeight: 50 },
  bigSentence: { fontSize: 26, fontWeight: "900", color: P.violetDeep, lineHeight: 34, textAlign: "center", paddingHorizontal: 12 },
  meaning: { color: P.muted, fontSize: 14, fontWeight: "800", marginBottom: 14 },
  exampleCard: { alignSelf: "stretch", marginTop: 20, borderWidth: 1, borderColor: "#eeeafc", borderRadius: 18, padding: 14, gap: 5, backgroundColor: "#fbfaff" },
  exampleKicker: { color: P.violet, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  patternRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 20, alignSelf: "stretch", paddingHorizontal: 6 },
  patternBox: { flex: 1, borderRadius: 13, padding: 11, backgroundColor: P.violetSoft, alignItems: "center" },
  journey: { borderRadius: 18, borderWidth: 1, borderColor: "#e5e1ff", paddingVertical: 9, paddingHorizontal: 13 },
  journeyCopy: { gap: 1 },
  journeyPromise: { color: "#77728f", fontSize: 8, fontWeight: "700", textAlign: "right", maxWidth: 150, position: "absolute", right: 0, bottom: 6, lineHeight: 11 },
  journeyTrack: { height: 34, marginTop: 4, marginHorizontal: 8, position: "relative" },
  journeyFill: { position: "absolute", top: 18, left: 0, height: 5, borderRadius: 99, backgroundColor: P.violet },
  journeyStop: { position: "absolute", top: 8, fontSize: 18 },
  journeyRunner: { position: "absolute", top: -7, fontSize: 22 },
  recallPrompt: { minHeight: 105, borderWidth: 2, borderStyle: "dashed", borderColor: "#d9d5fb", borderRadius: 20, padding: 18, backgroundColor: "#f8f7ff", alignItems: "center", justifyContent: "center" },
  dictationPrompt: { minHeight: 120, borderRadius: 20, padding: 18, backgroundColor: "#f0edff", alignItems: "center", justifyContent: "center", gap: 11 },
  textInput: { height: 48, borderWidth: 1, borderColor: "#dfe1eb", borderRadius: 14, paddingHorizontal: 13, color: P.ink, backgroundColor: "#fff", fontSize: 12, fontWeight: "700" },
  feedback: { position: "relative", flexDirection: "row", alignItems: "center", gap: 11, minHeight: 104, marginTop: 10, borderRadius: 19, paddingLeft: 10, paddingRight: 14, paddingVertical: 12 },
  dock: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: P.line, marginTop: 9, paddingTop: 10 },
  recordingRow: { height: 64, alignItems: "center", flexDirection: "row", gap: 5, marginVertical: 16 },
  dialogScene: { gap: 3, borderRadius: 16, padding: 12, backgroundColor: "#e4f9f4" },
  chatBubble: { maxWidth: "84%", borderTopLeftRadius: 4, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderTopRightRadius: 14, padding: 10, backgroundColor: "#f0f2f7", alignSelf: "flex-start" },
  chatBubbleStudent: { alignSelf: "flex-end", borderTopRightRadius: 4, borderTopLeftRadius: 14, backgroundColor: P.violet },
  dialogReplies: { flexDirection: "row", gap: 6, paddingBottom: 9, flexWrap: "wrap" },
});
