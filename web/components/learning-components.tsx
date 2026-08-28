"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, LumiMascot, Pill, type Tone } from "./student-ui";
import { API_BASE, startPcmRecording, transcribePcm } from "./speech";

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

function useGentleNudge(active = true, delay = 7000) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { setVisible(true); playLumiSound("help"); }, delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);
  return [active && visible, setVisible] as const;
}

export function LessonJourney({ step, total }: { step: number; total: number }) {
  const percent = Math.max(6, Math.min(100, ((step + 1) / total) * 100));
  const chapter = step < 3 ? "在果园收集水果" : step < 6 ? "带着水果去商店" : "在水果店完成挑战";
  return <section className="lesson-journey" aria-label={`课程旅程已完成 ${step + 1} 个环节，共 ${total} 个环节`}><div className="journey-copy"><span>水果店大冒险</span><strong>{chapter}</strong><small>{storyBeats[Math.min(step, storyBeats.length - 1)].promise}</small></div><div className="journey-track" aria-hidden="true"><i style={{ width: `${percent}%` }} /><span className="journey-stop start">🌳</span><span className="journey-stop middle">🛤</span><span className="journey-stop end">🏪</span><b style={{ left: `calc(${percent}% - 13px)` }}>🦌</b></div></section>;
}

function ActivityFrame({ activity, step, children }: { activity: LessonActivity; step: number; children: React.ReactNode }) {
  const message = activity.type === "dialog" ? "把刚学会的表达，用到小对话里吧！" : activity.message;
  const story = storyBeats[Math.min(step, storyBeats.length - 1)];
  const guideMood = activity.type === "pronunciation" ? "listening" : activity.type === "recall" || activity.type === "dialog" ? "curious" : "neutral";
  return (
    <Card className={`activity-shell activity-${activity.type}`}>
      <div className="activity-guide"><LumiMascot size="small" mood={guideMood} /><div><span>{story.place}</span><strong>{story.title}</strong><p>{message}</p></div></div>
      <div className="activity-body">{children}</div>
    </Card>
  );
}

function FeedbackPanel({ kind, title, text }: { kind: "correct" | "wrong"; title: string; text: string }) {
  return <div className={`lesson-feedback ${kind}`} role="status"><div className="feedback-burst" aria-hidden="true"><i>★</i><i>✦</i><i>●</i><i>★</i></div><LumiMascot size="medium" mood={kind === "correct" ? "happy" : "encourage"} /><div><small>{kind === "correct" ? "太棒啦！" : "Lumi 陪你再试试"}</small><strong>{title}</strong><span>{text}</span></div></div>;
}

function GentleSupportPanel({ title, text, actionLabel, onAction, onClose }: { title: string; text: string; actionLabel: string; onAction: () => void; onClose: () => void }) {
  return <div className="lesson-support" role="status"><LumiMascot size="small" mood="resting" /><div><strong>{title}</strong><span>{text}</span><button type="button" onClick={onAction}>{actionLabel}</button></div><button className="support-close" type="button" onClick={onClose} aria-label="收起 Lumi 的陪伴提示">×</button></div>;
}

function ActivityActionDock({ primaryLabel, onPrimary, primaryDisabled = false, onPrevious, canPrevious, primaryType = "button" }: { primaryLabel: string; onPrimary?: () => void; primaryDisabled?: boolean; onPrevious: () => void; canPrevious: boolean; primaryType?: "button" | "submit" }) {
  return <div className="lesson-action-dock"><Button variant="secondary" type="button" disabled={!canPrevious} onClick={onPrevious}>← 回到上一步</Button><Button type={primaryType} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</Button></div>;
}

function AudioButton({ text, label = "听标准发音" }: { text: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  return <button className={playing ? "lesson-audio-button playing" : "lesson-audio-button"} type="button" onClick={() => speak(text, setPlaying)} aria-label={`${label}：${text}`}><span>{playing ? "◼" : "▶"}</span>{playing ? "正在播放" : label}</button>;
}

function WordView({ activity, onNext, onPrevious, canPrevious }: { activity: WordActivity; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [supportOpen, setSupportOpen] = useGentleNudge();
  const next = () => { playLumiSound("correct"); onNext(); };
  const listenWithLumi = () => { speak(activity.word, () => undefined); setSupportOpen(false); };
  return <div className="word-learning-card"><div className="activity-content"><span className="activity-kicker">今天的新朋友</span><strong className="activity-main-word">{activity.word}</strong><span className="activity-meaning">{activity.meaning}</span><AudioButton text={activity.word} /><div className="example-card"><span>放进一句话里</span><strong>{activity.example}</strong><small>{activity.exampleMeaning}</small></div>{supportOpen && <GentleSupportPanel title="Lumi 来陪你啦" text="不用马上记住，我们和 Lumi 只听一遍也可以。" actionLabel="和 Lumi 听一遍" onAction={listenWithLumi} onClose={() => setSupportOpen(false)} />}</div><ActivityActionDock primaryLabel="收进水果篮 →" onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function SentenceView({ activity, onNext, onPrevious, canPrevious }: { activity: SentenceActivity; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [supportOpen, setSupportOpen] = useGentleNudge();
  const next = () => { playLumiSound("correct"); onNext(); };
  const listenWithLumi = () => { speak(activity.sentence, () => undefined); setSupportOpen(false); };
  return <div className="sentence-learning-card"><div className="activity-content"><span className="activity-kicker">今天的神奇句子</span><strong className="activity-main-sentence">{activity.sentence}</strong><span className="activity-meaning">{activity.meaning}</span><AudioButton text={activity.sentence} label="听一听整句话" /><div className="sentence-pattern"><span>I like</span><i>＋</i><span>喜欢的事物</span></div>{supportOpen && <GentleSupportPanel title="Lumi 来陪你啦" text="今天只听懂一点点，也是在进步。" actionLabel="陪我听整句话" onAction={listenWithLumi} onClose={() => setSupportOpen(false)} />}</div><ActivityActionDock primaryLabel="带上这句话 →" onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function RecallView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: RecallActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const isAudio = activity.mode === "audio_to_text";
  const [supportOpen, setSupportOpen] = useGentleNudge(!answer.trim() && !result);
  const finished = result === "correct" || attempts >= 3;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!answer.trim()) return;
    const correct = normalize(answer) === normalize(activity.answer);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setResult(correct ? "correct" : "wrong");
    setSupportOpen(false);
    playLumiSound(correct ? "correct" : "retry");
    if (correct || nextAttempts >= 3) onCompleted(correct);
  };
  const wrongHint = attempts === 1 ? (isAudio ? "再听一次，注意每一个词。" : `小提示：答案有 ${activity.answer.replace(/\s/g, "").length} 个字符。`) : attempts === 2 ? `再给一个提示：答案从“${activity.answer.slice(0, 1)}”开始。` : `一起记住它：${activity.answer}`;
  const giveAHand = () => {
    if (isAudio) speak(activity.prompt, () => undefined);
    else setAnswer(activity.answer.slice(0, 1));
    setSupportOpen(false);
  };
  return <form className="recall-learning-card" onSubmit={finished ? (event) => { event.preventDefault(); onNext(); } : submit}><div className="activity-content">{isAudio ? <div className="dictation-prompt"><AudioButton text={activity.prompt} label="点击听题" /><small>题目藏在声音里，仔细听哦</small></div> : <div className="recall-prompt">{activity.prompt}</div>}<div className="recall-form"><label htmlFor="recall-answer">我的答案</label><input id="recall-answer" value={answer} disabled={result === "correct"} onChange={(event) => setAnswer(event.target.value)} placeholder="在这里输入答案" autoComplete="off" /></div>{supportOpen ? <GentleSupportPanel title="Lumi 发现你在想办法" text="我先帮一点点，剩下的我们慢慢来。" actionLabel={isAudio ? "再帮我读一遍" : "帮我写第一个字"} onAction={giveAHand} onClose={() => setSupportOpen(false)} /> : <>{result === "correct" && <FeedbackPanel kind="correct" title="苹果装进篮子啦！" text="你找到了答案，Lumi 开心地跳起来啦！" />}{result === "wrong" && <FeedbackPanel kind="wrong" title={attempts >= 3 ? "没关系，我们一起记住" : "差一点点，继续试试看"} text={wrongHint} />}</>}</div><ActivityActionDock primaryLabel={finished ? "继续赶路 →" : attempts ? "再检查一次" : "检查答案"} primaryDisabled={!finished && !answer.trim()} primaryType="submit" onPrevious={onPrevious} canPrevious={canPrevious} /></form>;
}

function PronunciationView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: PronunciationActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [supportOpen, setSupportOpen] = useGentleNudge(state === "idle");
  const complete = () => { setState("done"); setSupportOpen(false); playLumiSound("correct"); onCompleted(true); };
  const primary = state === "idle" ? () => setState("recording") : state === "recording" ? complete : onNext;
  const listenFirst = () => { setState("idle"); speak(activity.content, () => undefined); setSupportOpen(false); };
  return <div className="pronunciation-learning-card"><div className="activity-content"><strong className="activity-main-word">{activity.content}</strong><span className="activity-meaning">{activity.meaning}</span><AudioButton text={activity.content} /><div className={state === "recording" ? "recording-visual active" : "recording-visual"} aria-hidden="true">{[1,2,3,4,5,6,7].map((bar) => <i key={bar} />)}</div>{supportOpen ? <GentleSupportPanel title="Lumi 来陪你热热身" text="先听 Lumi 读一遍，嘴巴准备好再开始。" actionLabel="我先听一遍" onAction={listenFirst} onClose={() => setSupportOpen(false)} /> : state === "done" && <FeedbackPanel kind="correct" title="声音飞过小木桥啦！" text="Lumi 听见你勇敢地开口了。" />}</div><ActivityActionDock primaryLabel={state === "idle" ? "🎙 开始跟读" : state === "recording" ? "■ 完成录音" : "继续去水果店 →"} onPrimary={primary} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function DialogView({ activity, onCompleted, onNext, onPrevious, canPrevious, isLast }: { activity: DialogActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean; isLast: boolean }) {
  const [messages, setMessages] = useState([{ role: "ai", text: activity.opening }]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [judging, setJudging] = useState(false); // 等 AI 判定中
  const [feedback, setFeedback] = useState<{ kind: "correct" | "wrong"; text: string } | null>(null);
  const [finished, setFinished] = useState(false); // 判定对了才能继续
  const recordingRef = useRef<{ stop: () => Uint8Array } | null>(null);
  const replies = ["I like apples.", "I like bananas."];
  const [supportOpen, setSupportOpen] = useGentleNudge(!finished && messages.length <= 1);

  // 把孩子说的话交给 AI 判定: 对 → 庆祝继续, 错 → 提示重试
  const sendUtterance = async (text: string) => {
    const value = text.trim();
    if (!value || judging || finished) return;
    setMessages((items) => [...items, { role: "student", text: value }]);
    setInput("");
    setJudging(true);
    setSupportOpen(false);
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/dialog-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: activity.scene, goal: activity.goal, opening: activity.opening, utterance: value }),
      });
      if (!res.ok) throw new Error(`判定接口错误: ${res.status}`);
      const data = await res.json();
      if (data.correct) {
        setFinished(true);
        setFeedback({ kind: "correct", text: data.feedback ? `${data.feedback}（${data.translation || ""}）` : "Great!" });
        playLumiSound("correct");
        onCompleted(true);
      } else {
        setFeedback({ kind: "wrong", text: data.hint || (data.feedback ? `${data.feedback}（${data.translation || ""}）` : "试着说：I like ...") });
        playLumiSound("retry");
      }
    } catch (err) {
      console.error("dialog check error:", err);
      setFeedback({ kind: "wrong", text: "哎呀，网络开小差了，再试一次好吗？" });
    } finally {
      setJudging(false);
    }
  };

  // 🎙 按钮: 第一次按开始录, 再按一次停止 → 转文字 → 交给判定
  const handleVoice = async () => {
    if (listening) {
      const rec = recordingRef.current;
      setListening(false);
      if (!rec) return;
      const pcm = rec.stop();
      recordingRef.current = null;
      if (pcm.length < 6400) return; // 少于 0.4s 当没说话
      try {
        const text = await transcribePcm(pcm);
        if (text.trim()) await sendUtterance(text);
        else setFeedback({ kind: "wrong", text: "再大声说一次好吗？" });
      } catch (err) {
        console.error("STT error:", err);
        setFeedback({ kind: "wrong", text: "没听清楚，再试一次好吗？" });
      }
    } else {
      try {
        recordingRef.current = null;
        recordingRef.current = { stop: await startPcmRecording() };
        setListening(true);
      } catch (err) {
        console.error("mic error:", err);
      }
    }
  };

  return <div className="dialog-learning-card"><div className="activity-content"><div className="dialog-scene"><span>你已经走进</span><strong>🍎 {activity.scene}</strong><small>{activity.goal}</small></div><div className="lesson-chat" aria-live="polite">{messages.map((message, index) => <div className={`lesson-chat-bubble ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}{judging && <div className="lesson-chat-bubble ai dialog-judging">Lumi 正在判断…</div>}</div>{feedback && <FeedbackPanel kind={feedback.kind} title={feedback.kind === "correct" ? "店员听懂你啦！" : "差一点点，再试一次"} text={feedback.text} />}{!finished && <><div className="dialog-replies">{replies.map((reply) => <button className={input === reply ? "selected" : ""} type="button" key={reply} onClick={() => setInput(reply)}>{reply}</button>)}</div><div className="dialog-input"><input value={input} disabled={judging} onChange={(event) => setInput(event.target.value)} placeholder="说英语，或点 🎙 录音" aria-label="场景对话回答" autoComplete="off" /><button className={listening ? "voice-button listening" : "voice-button"} type="button" aria-label="语音输入" onClick={handleVoice}>{listening ? "◼" : "🎙"}</button></div></>}{supportOpen && <GentleSupportPanel title="Lumi 来帮你选一句" text="点一下就能把整句话放进输入框，也可以按 🎙 自己说。" actionLabel="帮我选一句" onAction={() => { setInput(replies[0]); setSupportOpen(false); }} onClose={() => setSupportOpen(false)} />}</div><ActivityActionDock primaryLabel={finished ? (isLast ? "打开星星宝箱 ★" : "继续冒险 →") : judging ? "正在判断…" : feedback?.kind === "wrong" ? "再试一次 ↑" : "发送回答 ↑"} primaryDisabled={!finished && (judging || !input.trim())} onPrimary={finished ? onNext : () => sendUtterance(input)} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
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
  return <div className="lesson-complete"><div className="complete-confetti" aria-hidden="true"><i>★</i><i>✦</i><i>●</i><i>★</i><i>✦</i><i>●</i></div><div className="complete-stars" aria-hidden="true">★ ✦ ★</div><div className="complete-mascot-stage"><LumiMascot size="large" mood="proud" /><span>水果店小英雄</span></div><span className="activity-kicker">ADVENTURE COMPLETE</span><h2>你把英语带到水果店啦！</h2><p>Lumi 想抱抱你：愿意尝试、愿意开口，就是今天最棒的收获。</p><div className="complete-stats"><div><strong>{total}</strong><span>走过的小站</span></div><div><strong>{correct}</strong><span>收集的苹果</span></div><div><strong>★</strong><span>勇气贴纸</span></div></div><div className="complete-actions"><Button onClick={onRestart}>和 Lumi 再玩一次</Button><Button variant="secondary" onClick={onHome}>带着星星回乐园</Button></div></div>;
}
