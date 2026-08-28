import { createContext, FormEvent, useContext, useEffect, useMemo, useState } from "react";
import { Button, Card, LumiMascot, Pill, type LumiMood, type Tone } from "./student-ui";

export type RecallMode = "zh_to_en" | "en_to_zh" | "audio_to_text" | "fill_blank";

export type WordActivity = {
  type: "word";
  word: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  message: string;
};

export type SentenceActivity = {
  type: "sentence";
  sentence: string;
  meaning: string;
  message: string;
};

export type RecallActivity = {
  type: "recall";
  mode: RecallMode;
  prompt: string;
  answer: string;
  message: string;
};

export type PronunciationActivity = {
  type: "pronunciation";
  content: string;
  meaning: string;
  message: string;
};

export type DialogActivity = {
  type: "dialog";
  scene: string;
  goal: string;
  opening: string;
};

export type LessonActivity = WordActivity | SentenceActivity | RecallActivity | PronunciationActivity | DialogActivity;

export type LessonPackage = {
  id: string;
  title: string;
  intro: string;
  activities: LessonActivity[];
};

export const sampleLesson: LessonPackage = {
  id: "fruit_friends_01",
  title: "Fruit Friends",
  intro: "认识水果朋友，用 I like ... 说出你喜欢的水果。",
  activities: [
    { type: "word", word: "apple", meaning: "苹果", example: "I like apples.", exampleMeaning: "我喜欢苹果。", message: "先认识今天的水果朋友：apple！" },
    { type: "recall", mode: "en_to_zh", prompt: "apple", answer: "苹果", message: "apple 是什么意思呢？" },
    { type: "recall", mode: "zh_to_en", prompt: "苹果", answer: "apple", message: "苹果用英语怎么说？" },
    { type: "pronunciation", content: "apple", meaning: "苹果", message: "听一遍，再跟着 Lumi 读 apple。" },
    { type: "sentence", sentence: "I like apples.", meaning: "我喜欢苹果。", message: "I like ... 可以用来告诉别人你喜欢什么。" },
    { type: "recall", mode: "fill_blank", prompt: "I like ____.", answer: "apples", message: "把缺少的单词填进去吧！" },
    { type: "recall", mode: "audio_to_text", prompt: "I like apples.", answer: "I like apples.", message: "认真听，把听到的句子写下来。" },
    { type: "dialog", scene: "水果店", goal: "使用 I like ... 表达自己喜欢的水果", opening: "Hello! What fruit do you like?" },
  ],
};

export const activityCatalog: Array<{ type: LessonActivity["type"]; icon: string; studentTitle: string; studentDescription: string; tone: Tone }> = [
  { type: "word", icon: "Aa", studentTitle: "认识水果朋友", studentDescription: "先收集今天的新单词", tone: "yellow" },
  { type: "sentence", icon: "句", studentTitle: "神奇句子袋", studentDescription: "学会一句有用的话", tone: "sky" },
  { type: "recall", icon: "想", studentTitle: "记忆小挑战", studentDescription: "听一听、想一想、填一填", tone: "violet" },
  { type: "pronunciation", icon: "说", studentTitle: "勇敢开口读", studentDescription: "跟着 Lumi 大声说", tone: "pink" },
  { type: "dialog", icon: "聊", studentTitle: "水果店大冒险", studentDescription: "把学过的英语用起来", tone: "mint" },
];

const storyBeats = [
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

function speak(text: string, onState: (value: boolean) => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  utterance.onstart = () => onState(true);
  utterance.onend = () => onState(false);
  utterance.onerror = () => onState(false);
  window.speechSynthesis.speak(utterance);
}

type LumiSound = "correct" | "retry" | "help" | "complete";

function playLumiSound(kind: LumiSound) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext();
  const notes = kind === "complete" ? [523.25, 659.25, 783.99, 1046.5] : kind === "correct" ? [523.25, 659.25, 783.99] : kind === "help" ? [392, 493.88] : [349.23, 392];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.09;
    oscillator.type = kind === "retry" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(kind === "complete" ? 0.095 : kind === "retry" ? 0.052 : kind === "correct" ? 0.088 : 0.068, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  });
  window.setTimeout(() => void context.close(), 600);
}

export function LessonJourney({ step, total }: { step: number; total: number }) {
  const chapter = step < 3 ? "在果园收集水果" : step < 6 ? "带着水果去商店" : "在水果店完成挑战";
  const visibleCount = Math.min(5, total);
  const start = Math.max(0, Math.min(step - 2, total - visibleCount));
  const visibleSteps = Array.from({ length: visibleCount }, (_, offset) => start + offset);
  return <section className="lesson-journey" aria-label={`课程旅程已完成 ${step + 1} 个环节，共 ${total} 个环节`}><div className="journey-copy"><strong>{chapter}</strong><span>{step + 1} / {total}</span></div><div className="journey-node-map" aria-hidden="true"><ol className="journey-nodes">{visibleSteps.map((index, position) => <li className={`${index < step ? "completed" : index === step ? "current" : "upcoming"}${position < visibleSteps.length - 1 ? " connected" : ""}`} key={index}><span>{index < step ? "✓" : index + 1}</span></li>)}</ol></div></section>;
}

const MascotMoodContext = createContext<{ setMood: (mood: LumiMood) => void } | null>(null);

function ActivityFrame({ activity, step, children }: { activity: LessonActivity; step: number; children: React.ReactNode }) {
  const message = activity.type === "dialog" ? "把刚学会的表达，用到小对话里吧！" : activity.message;
  const story = storyBeats[Math.min(step, storyBeats.length - 1)];
  const guideMood: LumiMood = activity.type === "pronunciation" ? "listening" : activity.type === "recall" || activity.type === "dialog" ? "curious" : "neutral";
  const [mascotMood, setMascotMood] = useState<LumiMood>(guideMood);
  useEffect(() => setMascotMood(guideMood), [guideMood, step]);
  return (
    <MascotMoodContext.Provider value={{ setMood: setMascotMood }}>
      <section className={`activity-shell activity-${activity.type}`}>
        <div className="activity-mentor-stage"><div className="mentor-story"><span>{story.place} · {story.title}</span><strong>{message}</strong></div><LumiMascot size="large" variant="full" mood={mascotMood} /></div>
        <div className="activity-body">{children}</div>
      </section>
    </MascotMoodContext.Provider>
  );
}

function FeedbackPanel({ kind, title, text }: { kind: "correct" | "wrong"; title: string; text: string }) {
  const mascot = useContext(MascotMoodContext);
  useEffect(() => mascot?.setMood(kind === "correct" ? "happy" : "encourage"), [kind, mascot]);
  return <div className={`lesson-feedback ${kind}`} role="status">{kind === "correct" && <div className="feedback-burst" aria-hidden="true"><i>★</i><i>✦</i><i>●</i><i>★</i></div>}<span className="feedback-state-icon" aria-hidden="true">{kind === "correct" ? "✓" : "↻"}</span><div><strong>{title}</strong><span>{text}</span></div></div>;
}

function ActivityActionDock({ primaryLabel, onPrimary, primaryDisabled = false, onPrevious, canPrevious, primaryType = "button", feedback }: { primaryLabel: string; onPrimary?: () => void; primaryDisabled?: boolean; onPrevious: () => void; canPrevious: boolean; primaryType?: "button" | "submit"; feedback?: React.ReactNode }) {
  return <div className={`lesson-action-dock${feedback ? " has-feedback" : ""}`}>{feedback}<div className="lesson-action-row"><Button variant="secondary" type="button" disabled={!canPrevious} onClick={onPrevious} aria-label="回到上一步">←</Button><Button type={primaryType} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</Button></div></div>;
}

function AudioButton({ text, label = "听标准发音" }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  return <button className={playing ? "lesson-audio-button playing" : "lesson-audio-button"} type="button" onClick={() => speak(text, setPlaying)} aria-label={`${label}：${text}`}><span>{playing ? "◼" : "▶"}</span>{playing ? "正在播放" : label}</button>;
}

function WordView({ activity, onNext, onPrevious, canPrevious }: { activity: WordActivity; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const next = () => { playLumiSound("correct"); onNext(); };
  return <div className="word-learning-card"><div className="activity-content"><span className="activity-kicker">今天的新朋友</span><strong className="activity-main-word">{activity.word}</strong><span className="activity-meaning">{activity.meaning}</span><AudioButton text={activity.word} /><div className="example-card"><span>放进一句话里</span><strong>{activity.example}</strong><small>{activity.exampleMeaning}</small></div></div><ActivityActionDock primaryLabel="收进水果篮 →" onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function SentenceView({ activity, onNext, onPrevious, canPrevious }: { activity: SentenceActivity; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const next = () => { playLumiSound("correct"); onNext(); };
  return <div className="sentence-learning-card"><div className="activity-content"><span className="activity-kicker">今天的神奇句子</span><strong className="activity-main-sentence">{activity.sentence}</strong><span className="activity-meaning">{activity.meaning}</span><AudioButton text={activity.sentence} label="听一听整句话" /><div className="sentence-pattern"><span>I like</span><i>＋</i><span>喜欢的事物</span></div></div><ActivityActionDock primaryLabel="带上这句话 →" onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function RecallView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: RecallActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const isAudio = activity.mode === "audio_to_text";
  const answerLanguage = activity.mode === "en_to_zh" ? "中" : "Aa";
  const finished = result === "correct" || attempts >= 3;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!answer.trim()) return;
    const correct = normalize(answer) === normalize(activity.answer);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setResult(correct ? "correct" : "wrong");
    playLumiSound(correct ? "correct" : "retry");
    if (correct || nextAttempts >= 3) onCompleted(correct);
  };
  const wrongHint = attempts === 1 ? (isAudio ? "再听一次，注意每一个词。" : `小提示：答案有 ${activity.answer.replace(/\s/g, "").length} 个字符。`) : attempts === 2 ? `再给一个提示：答案从“${activity.answer.slice(0, 1)}”开始。` : `一起记住它：${activity.answer}`;
  const feedback = result === "correct"
    ? <FeedbackPanel kind="correct" title="答对啦！" text="你找到了正确答案。" />
    : result === "wrong"
      ? <FeedbackPanel kind="wrong" title={attempts >= 3 ? "一起记住它" : "再试一次"} text={wrongHint} />
      : undefined;
  const answerState = result ? `is-${result}` : answer.trim() ? "is-filled" : "";
  return (
    <form className="recall-learning-card" onSubmit={finished ? (event) => { event.preventDefault(); onNext(); } : submit}>
      <div className="activity-content">
        <div className="recall-question-stage">
          {isAudio ? <AudioButton text={activity.prompt} label="点击听题" /> : <strong className="recall-prompt">{activity.prompt}</strong>}
        </div>
        <div className={`recall-form ${answerState}`}>
          <div className="recall-input-shell">
            <input id="recall-answer" value={answer} disabled={result === "correct"} onChange={(event) => { setAnswer(event.target.value); if (result === "wrong") setResult(null); }} placeholder={answerLanguage === "中" ? "输入中文意思…" : "输入英文答案…"} autoComplete="off" />
            <span aria-hidden="true">{result === "correct" ? "✓" : answerLanguage}</span>
          </div>
        </div>
      </div>
      <ActivityActionDock feedback={feedback} primaryLabel={finished ? "继续" : attempts ? "再检查一次" : "检查答案"} primaryDisabled={!finished && !answer.trim()} primaryType="submit" onPrevious={onPrevious} canPrevious={canPrevious} />
    </form>
  );
}

function PronunciationView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: PronunciationActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const complete = () => { setState("done"); playLumiSound("correct"); onCompleted(true); };
  const primary = state === "idle" ? () => setState("recording") : state === "recording" ? complete : onNext;
  const feedback = state === "done" ? <FeedbackPanel kind="correct" title="读得真棒！" text="Lumi 清楚地听见你了。" /> : undefined;
  return <div className="pronunciation-learning-card"><div className="activity-content"><strong className="activity-main-word">{activity.content}</strong><span className="activity-meaning">{activity.meaning}</span><AudioButton text={activity.content} /><div className={state === "recording" ? "recording-visual active" : "recording-visual"} aria-hidden="true">{[1,2,3,4,5,6,7].map((bar) => <i key={bar} />)}</div></div><ActivityActionDock feedback={feedback} primaryLabel={state === "idle" ? "开始跟读" : state === "recording" ? "完成录音" : "继续"} onPrimary={primary} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function DialogView({ activity, onCompleted, onNext, onPrevious, canPrevious, isLast }: { activity: DialogActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean; isLast: boolean }) {
  const [messages, setMessages] = useState([{ role: "ai", text: activity.opening }]);
  const [input, setInput] = useState("");
  const [sent, setSent] = useState(false);
  const replies = ["I like apples.", "I like bananas."];
  const send = () => {
    const value = input.trim();
    if (!value) return;
    setMessages((items) => [...items, { role: "student", text: value }, { role: "ai", text: "Great! That sounds delicious. Me too!" }]);
    setSent(true);
    playLumiSound("correct");
    onCompleted(true);
  };
  const feedback = sent ? <FeedbackPanel kind="correct" title="对话完成！" text="店员听懂了你的英语。" /> : undefined;
  return <div className="dialog-learning-card"><div className="activity-content"><div className="dialog-scene"><span>情景对话</span><strong>🍎 {activity.scene}</strong><small>告诉店员你喜欢什么水果</small></div><div className="lesson-chat" aria-live="polite">{messages.map((message, index) => <div className={`lesson-chat-bubble ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}</div>{!sent && <><div className="dialog-replies">{replies.map((reply) => <button className={input === reply ? "selected" : ""} type="button" key={reply} onClick={() => setInput(reply)}>{reply}</button>)}</div><div className="dialog-input"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="用英语回答" aria-label="场景对话回答" /></div></>}</div><ActivityActionDock feedback={feedback} primaryLabel={sent ? isLast ? "打开星星宝箱" : "继续" : "发送回答"} primaryDisabled={!sent && !input.trim()} onPrimary={sent ? onNext : send} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

export function LessonActivityView({ activity, step, total, onCompleted, onNext, onPrevious, canPrevious }: { activity: LessonActivity; step: number; total: number; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const completeAndNext = () => { onCompleted(true); onNext(); };
  return <div className="lesson-focus-layout"><LessonJourney step={step} total={total} /><ActivityFrame activity={activity} step={step}>{activity.type === "word" ? <WordView activity={activity} onNext={completeAndNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : activity.type === "sentence" ? <SentenceView activity={activity} onNext={completeAndNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : activity.type === "recall" ? <RecallView key={`${step}-${activity.mode}`} activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : activity.type === "pronunciation" ? <PronunciationView key={step} activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : <DialogView key={step} activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} isLast={step === total - 1} />}</ActivityFrame></div>;
}

export function LearningTypeGrid({ onSelect }: { onSelect: (type: LessonActivity["type"]) => void }) {
  return <div className="component-type-grid">{activityCatalog.map((item) => <button type="button" className={`component-type-card tone-${item.tone}`} key={item.type} onClick={() => onSelect(item.type)}><span className="component-type-icon">{item.icon}</span><span><strong>{item.studentTitle}</strong><i>{item.studentDescription}</i></span><b aria-hidden="true">›</b></button>)}</div>;
}

export function LessonCourseCard({ lesson, onStart }: { lesson: LessonPackage; onStart: () => void }) {
  const typeCount = useMemo(() => new Set(lesson.activities.map((activity) => activity.type)).size, [lesson]);
  return <Card className="lesson-course-card"><div className="course-art"><span>abc</span><b>🍎</b></div><div className="course-copy"><Pill tone="mint">今日冒险</Pill><h3>水果店大冒险</h3><p>{lesson.intro}</p><div><span>{lesson.activities.length} 个小挑战</span><span>{typeCount} 种玩法</span><span>约 12 分钟</span></div></div><Button onClick={onStart}>和 Lumi 出发</Button></Card>;
}

export function LessonComplete({ correct, total, onRestart, onHome }: { correct: number; total: number; onRestart: () => void; onHome: () => void }) {
  useEffect(() => { playLumiSound("complete"); }, []);
  return <div className="lesson-complete"><div className="complete-confetti" aria-hidden="true"><i>★</i><i>✦</i><i>●</i><i>★</i><i>✦</i><i>●</i></div><div className="complete-stars" aria-hidden="true">★ ✦ ★</div><div className="complete-mascot-stage"><LumiMascot size="large" variant="full" mood="proud" /><span>水果店小英雄</span></div><span className="activity-kicker">ADVENTURE COMPLETE</span><h2>你把英语带到水果店啦！</h2><p>Lumi 想抱抱你：愿意尝试、愿意开口，就是今天最棒的收获。</p><div className="complete-stats"><div><strong>{total}</strong><span>走过的小站</span></div><div><strong>{correct}</strong><span>收集的苹果</span></div><div><strong>★</strong><span>勇气贴纸</span></div></div><div className="complete-actions"><Button onClick={onRestart}>和 Lumi 再玩一次</Button><Button variant="secondary" onClick={onHome}>带着星星回乐园</Button></div></div>;
}
