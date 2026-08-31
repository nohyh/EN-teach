import { createContext, FormEvent, useContext, useEffect, useState } from "react";
import { Button, LumiMascot, type LumiMood, type Tone } from "./student-ui";
import type {
  Activity as LessonActivity,
  DialogComponent as DialogActivity,
  PronunciationComponent as PronunciationActivity,
  RecallComponent as RecallActivity,
  SentenceComponent as SentenceActivity,
  WordComponent as WordActivity,
} from "../types/lesson";
import type { DialogCheckResult, EvaluationResult, SpeechRuntime } from "../types/speech";
import type { CoursePresentation } from "./course-presentation";

const SpeechRuntimeContext = createContext<SpeechRuntime | null>(null);

export function SpeechRuntimeProvider({ runtime, children }: { runtime: SpeechRuntime; children: React.ReactNode }) {
  return <SpeechRuntimeContext.Provider value={runtime}>{children}</SpeechRuntimeContext.Provider>;
}

export const activityCatalog: Array<{ type: LessonActivity["type"]; icon: string; studentTitle: string; studentDescription: string; tone: Tone }> = [
  { type: "word", icon: "Aa", studentTitle: "认识新单词", studentDescription: "收集今天的新单词", tone: "yellow" },
  { type: "sentence", icon: "句", studentTitle: "句子魔法", studentDescription: "学会一句有用的话", tone: "sky" },
  { type: "recall", icon: "想", studentTitle: "记忆小挑战", studentDescription: "听一听、想一想、填一填", tone: "violet" },
  { type: "pronunciation", icon: "说", studentTitle: "勇敢开口读", studentDescription: "跟着 Lumi 大声说", tone: "pink" },
  { type: "dialog", icon: "聊", studentTitle: "情景对话", studentDescription: "把学过的英语用起来", tone: "mint" },
];

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/[.,!?;:'"()[\]{}，。！？；：“”‘’]/g, " ").replace(/\s+/g, " ").trim();
}

function speak(text: string, onState: (value: boolean) => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (document.documentElement.dataset.sound === "off") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = document.documentElement.dataset.slowSpeech === "on" ? 0.68 : 0.82;
  utterance.onstart = () => onState(true);
  utterance.onend = () => onState(false);
  utterance.onerror = () => onState(false);
  window.speechSynthesis.speak(utterance);
}

type LumiSound = "correct" | "retry" | "help" | "complete";

function playLumiSound(kind: LumiSound) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  if (document.documentElement.dataset.sound === "off") return;
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

export function LessonJourney({ step, total, presentation }: { step: number; total: number; presentation: CoursePresentation }) {
  const chapter = presentation.journey[step % presentation.journey.length]?.title ?? presentation.scene;
  const visibleCount = Math.min(5, total);
  const start = Math.max(0, Math.min(step - 2, total - visibleCount));
  const visibleSteps = Array.from({ length: visibleCount }, (_, offset) => start + offset);
  return <section className="lesson-journey" aria-label={`课程旅程已完成 ${step + 1} 个环节，共 ${total} 个环节`}><div className="journey-copy"><strong>{chapter}</strong><span>{step + 1} / {total}</span></div><div className="journey-node-map" aria-hidden="true"><ol className="journey-nodes">{visibleSteps.map((index, position) => <li className={`${index < step ? "completed" : index === step ? "current" : "upcoming"}${position < visibleSteps.length - 1 ? " connected" : ""}`} key={index}><span>{index < step ? "✓" : index + 1}</span></li>)}</ol></div></section>;
}

const MascotMoodContext = createContext<{ setMood: (mood: LumiMood) => void } | null>(null);

function ActivityFrame({ activity, step, presentation, children }: { activity: LessonActivity; step: number; presentation: CoursePresentation; children: React.ReactNode }) {
  const message = activity.type === "dialog" ? "把刚学会的表达，用到小对话里吧！" : activity.message;
  const story = presentation.journey[step % presentation.journey.length];
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

function useSpeechPlayback(text: string) {
  const [playing, setPlaying] = useState(false);
  const runtime = useContext(SpeechRuntimeContext);
  const play = async () => {
    if (playing) return;
    if (!runtime) {
      speak(text, setPlaying);
      return;
    }
    setPlaying(true);
    try {
      await runtime.speakText(text);
      setPlaying(false);
    } catch {
      setPlaying(false);
      speak(text, setPlaying);
    }
  };
  return { play, playing };
}

function AudioButton({ text, label = "听标准发音", disabled = false }: { text: string; label?: string; disabled?: boolean }) {
  const { play, playing } = useSpeechPlayback(text);
  return <button className={playing ? "lesson-audio-button playing" : "lesson-audio-button"} type="button" disabled={disabled || playing} onClick={() => void play()} aria-label={`${label}：${text}`}><span aria-hidden="true">{playing ? "◼" : "🔊"}</span></button>;
}

function SpeakableText({ text, className, cue = "点击听标准发音" }: { text: string; className: string; cue?: string }) {
  const { play, playing } = useSpeechPlayback(text);
  return <button className={`speakable-text ${className}${playing ? " playing" : ""}`} type="button" onClick={() => void play()} disabled={playing} aria-label={`${cue}：${text}`}><strong>{text}</strong><span aria-hidden="true">{playing ? "◼" : "🔊"}</span></button>;
}

function WordView({ activity, presentation, onNext, onPrevious, canPrevious }: { activity: WordActivity; presentation: CoursePresentation; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const next = () => { playLumiSound("correct"); onNext(); };
  return <div className="word-learning-card"><div className="activity-content"><span className="activity-kicker">今天的新单词</span><SpeakableText text={activity.word} className="activity-main-word" /><span className="activity-meaning">{activity.meaning}</span><div className="example-card"><span>放进一句话里</span><SpeakableText text={activity.example} className="example-sentence" cue="点击听例句" /><small>{activity.exampleMeaning}</small></div></div><ActivityActionDock primaryLabel={presentation.wordActionLabel} onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function SentenceView({ activity, presentation, onNext, onPrevious, canPrevious }: { activity: SentenceActivity; presentation: CoursePresentation; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const next = () => { playLumiSound("correct"); onNext(); };
  return <div className="sentence-learning-card"><div className="activity-content"><span className="activity-kicker">今天的神奇句子</span><SpeakableText text={activity.sentence} className="activity-main-sentence" cue="点击听整句话" /><span className="activity-meaning">{activity.meaning}</span>{presentation.sentencePattern && <div className="sentence-pattern"><span>{presentation.sentencePattern.prefix}</span><i>＋</i><span>{presentation.sentencePattern.suffix}</span></div>}</div><ActivityActionDock primaryLabel={presentation.sentenceActionLabel} onPrimary={next} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

function RecallView({ activity, onCompleted, onNext, onPrevious, canPrevious }: { activity: RecallActivity; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const isAudio = activity.mode === "audio_to_text";
  const promptHasEnglish = /[a-z]/i.test(activity.prompt);
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
          {isAudio ? <AudioButton text={activity.prompt} label="点击听题" /> : promptHasEnglish ? <SpeakableText text={activity.prompt} className="recall-prompt" cue="点击听题目" /> : <strong className="recall-prompt">{activity.prompt}</strong>}
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
  const runtime = useContext(SpeechRuntimeContext);
  const [state, setState] = useState<"idle" | "recording" | "evaluating" | "done" | "error">("idle");
  const [score, setScore] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => { void runtime?.cancelRecording(); }, [runtime]);

  const start = async () => {
    if (!runtime) {
      setError("当前页面没有连接录音能力，请从 App 首页进入");
      setState("error");
      return;
    }
    setError("");
    setScore(null);
    try {
      await runtime.startRecording();
      setState("recording");
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : "无法开始录音");
      setState("error");
    }
  };

  const evaluate = async () => {
    if (!runtime) return;
    setState("evaluating");
    try {
      const result = await runtime.stopAndEvaluate(activity.content);
      setScore(result);
      setState("done");
      playLumiSound(result.passed ? "correct" : "help");
      onCompleted(result.passed);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "评分失败，请重试");
      setState("error");
    }
  };

  const retry = async () => {
    await runtime?.cancelRecording();
    await start();
  };
  const previous = async () => {
    await runtime?.cancelRecording();
    onPrevious();
  };
  const primary = state === "idle" || state === "error" ? start : state === "recording" ? evaluate : state === "done" ? onNext : undefined;
  const primaryLabel = state === "idle" ? "开始跟读" : state === "recording" ? "完成录音并评分" : state === "evaluating" ? "正在评分…" : state === "done" ? "继续" : "重新录音";
  const feedback = score
    ? <FeedbackPanel kind={score.passed ? "correct" : "wrong"} title={`${Math.round(score.overall)} 分 · ${score.passed ? "读得真棒！" : "再清楚一点就更好"}`} text={`准确度 ${Math.round(score.accuracy)} · 流利度 ${Math.round(score.fluency)}${score.mode === "mock" ? "（本地演示评分）" : ""}`} />
    : error
      ? <FeedbackPanel kind="wrong" title="这次没有评上分" text={error} />
      : undefined;
  return <div className="pronunciation-learning-card"><div className="activity-content"><SpeakableText text={activity.content} className="activity-main-word" /><span className="activity-meaning">{activity.meaning}</span><div className={state === "recording" ? "recording-visual active" : "recording-visual"} aria-label={state === "recording" ? "正在录音" : state === "evaluating" ? "正在评分" : undefined}>{[1,2,3,4,5,6,7].map((bar) => <i key={bar} />)}</div>{state === "done" && !score?.passed && <button className="pronunciation-retry" type="button" onClick={() => void retry()}>再读一次</button>}</div><ActivityActionDock feedback={feedback} primaryLabel={primaryLabel} primaryDisabled={state === "evaluating"} onPrimary={primary} onPrevious={() => void previous()} canPrevious={canPrevious} /></div>;
}

function DialogView({ activity, presentation, onCompleted, onNext, onPrevious, canPrevious, isLast }: { activity: DialogActivity; presentation: CoursePresentation; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean; isLast: boolean }) {
  const runtime = useContext(SpeechRuntimeContext);
  const [messages, setMessages] = useState<Array<{ role: "ai" | "student"; text: string }>>([{ role: "ai", text: activity.opening }]);
  const [input, setInput] = useState("");
  const [sent, setSent] = useState(false);
  const [judging, setJudging] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<DialogCheckResult | null>(null);
  const replies = presentation.quickReplies;
  useEffect(() => () => { void runtime?.cancelRecording(); }, [runtime]);

  const localJudge = (value: string): DialogCheckResult => {
    const normalizedValue = normalize(value);
    const correct = presentation.acceptedAnswers.some((answer) => normalizedValue.includes(normalize(answer)));
    return correct
      ? { correct: true, feedback: "Great! I understand you.", translation: "太棒了，Lumi 听懂了。", hint: "" }
      : { correct: false, feedback: "Try one more time in English.", translation: "试着用英语再说一次。", hint: replies[0] ?? "Hello!" };
  };

  const send = async () => {
    const value = input.trim();
    if (!value || judging) return;
    setJudging(true);
    let checked: DialogCheckResult;
    try {
      checked = runtime ? await runtime.checkDialog({ ...activity, utterance: value }) : localJudge(value);
    } catch {
      // DeepSeek 未配置时，保留课程的本地规则判定，真机仍可完成主要流程。
      checked = localJudge(value);
    }
    setMessages((items) => [...items, { role: "student", text: value }, { role: "ai", text: checked.feedback || checked.hint }]);
    setResult(checked);
    setJudging(false);
    if (checked.correct) {
      setSent(true);
      playLumiSound("correct");
      onCompleted(true);
    } else {
      playLumiSound("retry");
      setInput("");
    }
  };

  const toggleVoice = async () => {
    if (!runtime) return;
    try {
      if (!listening) {
        await runtime.startRecording();
        setListening(true);
      } else {
        const text = await runtime.stopAndTranscribe();
        setInput(text);
        setListening(false);
      }
    } catch (voiceError) {
      setListening(false);
      setResult({ correct: false, feedback: "没有听清楚", translation: voiceError instanceof Error ? voiceError.message : "请再试一次", hint: replies[0] ?? "Hello!" });
    }
  };
  const feedback = result ? <FeedbackPanel kind={result.correct ? "correct" : "wrong"} title={result.correct ? "对话完成！" : result.feedback || "再试一次"} text={result.translation || result.hint} /> : undefined;
  return <div className="dialog-learning-card"><div className="activity-content"><div className="dialog-scene"><span>情景对话</span><strong>✨ {activity.scene || presentation.scene}</strong><small>{presentation.dialogDescription}</small></div><div className="lesson-chat" aria-live="polite">{messages.map((message, index) => <div className={`lesson-chat-bubble ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}</div>{!sent && <><div className="dialog-replies">{replies.map((reply) => <button className={input === reply ? "selected" : ""} type="button" key={reply} onClick={() => setInput(reply)}>{reply}</button>)}</div><div className="dialog-input"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={listening ? "正在听你说…" : "用英语回答"} aria-label="场景对话回答" /><button className={listening ? "listening" : ""} type="button" onClick={() => void toggleVoice()} aria-label={listening ? "完成语音输入" : "开始语音输入"}>{listening ? "◼" : "🎙"}</button></div></>}</div><ActivityActionDock feedback={feedback} primaryLabel={sent ? isLast ? "打开星星宝箱" : "继续" : judging ? "正在判断…" : "发送回答"} primaryDisabled={!sent && (!input.trim() || judging)} onPrimary={sent ? onNext : () => void send()} onPrevious={onPrevious} canPrevious={canPrevious} /></div>;
}

export function LessonActivityView({ activity, presentation, step, total, onCompleted, onNext, onPrevious, canPrevious }: { activity: LessonActivity; presentation: CoursePresentation; step: number; total: number; onCompleted: (correct: boolean) => void; onNext: () => void; onPrevious: () => void; canPrevious: boolean }) {
  const completeAndNext = () => { onCompleted(true); onNext(); };
  return <div className="lesson-focus-layout"><LessonJourney step={step} total={total} presentation={presentation} /><ActivityFrame activity={activity} step={step} presentation={presentation}>{activity.type === "word" ? <WordView activity={activity} presentation={presentation} onNext={completeAndNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : activity.type === "sentence" ? <SentenceView activity={activity} presentation={presentation} onNext={completeAndNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : activity.type === "recall" ? <RecallView key={`${step}-${activity.mode}`} activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : activity.type === "pronunciation" ? <PronunciationView key={step} activity={activity} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} /> : <DialogView key={step} activity={activity} presentation={presentation} onCompleted={onCompleted} onNext={onNext} onPrevious={onPrevious} canPrevious={canPrevious} isLast={step === total - 1} />}</ActivityFrame></div>;
}

export function LearningTypeGrid({ onSelect }: { onSelect: (type: LessonActivity["type"]) => void }) {
  return <div className="component-type-grid">{activityCatalog.map((item) => <button type="button" className={`component-type-card tone-${item.tone}`} key={item.type} onClick={() => onSelect(item.type)}><span className="component-type-icon">{item.icon}</span><span><strong>{item.studentTitle}</strong><i>{item.studentDescription}</i></span><b aria-hidden="true">›</b></button>)}</div>;
}

export function LessonComplete({ correct, total, presentation, reward, onRestart, onHome, variant = "lesson" }: { correct: number; total: number; presentation: CoursePresentation; reward: number; onRestart: () => void; onHome: () => void; variant?: "lesson" | "review" }) {
  useEffect(() => { playLumiSound("complete"); }, []);
  return <div className="lesson-complete"><div className="complete-confetti" aria-hidden="true"><i>★</i><i>✦</i><i>●</i><i>★</i><i>✦</i><i>●</i></div><div className="complete-stars" aria-hidden="true">★ ✦ ★</div><div className="complete-mascot-stage"><LumiMascot size="large" variant="full" mood="proud" /><span>{presentation.rewardName}</span></div><span className="activity-kicker">{variant === "review" ? "REVIEW COMPLETE" : "ADVENTURE COMPLETE"}</span><h2>{presentation.completionTitle}</h2><p>{presentation.completionMessage}</p><div className="complete-stats"><div><strong>{total}</strong><span>{variant === "review" ? "复习的错题" : "走过的小站"}</span></div><div><strong>{correct}</strong><span>{variant === "review" ? "重新答对" : "答对的挑战"}</span></div><div><strong>+{reward}</strong><span>获得的星星</span></div></div><div className="complete-actions"><Button onClick={onRestart}>{variant === "review" ? "再巩固一遍" : "和 Lumi 再玩一次"}</Button><Button variant="secondary" onClick={onHome}>{variant === "review" ? "回到错题本" : "带着星星回乐园"}</Button></div></div>;
}
