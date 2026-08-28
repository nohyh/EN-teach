"use client";

import { FormEvent, useRef, useState } from "react";
import { activityCatalog, Button, Card, FloatingDecorations, LessonActivityView, LessonComplete, LessonCourseCard, LumiMascot, PageHeader, PhoneShell, Pill, ProgressBar, sampleLesson, SectionTitle, StatusBar, StudentPage, TaskRow, type StudentTab, type Tone } from "../components";
import { API_BASE, startPcmRecording, transcribePcm } from "../components/speech";

type EntryScreen = "login" | "role";
type Screen = EntryScreen | StudentTab;

const todayTasks = [
  { icon: "拼", title: "自然拼读", detail: "认识字母组合 sh", meta: "10分钟", reward: "+3⭐", tone: "mint" as Tone },
  { icon: "说", title: "动物园口语", detail: "和 Lumi 一起开口说", meta: "8分钟", reward: "+2⭐", tone: "pink" as Tone },
  { icon: "词", title: "单词复习", detail: "动物主题 12 个词", meta: "6分钟", reward: "+2⭐", tone: "yellow" as Tone },
];

function LoginPage({ onNext }: { onNext: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="stage"><PhoneShell label="登录页面" className="auth-page"><FloatingDecorations /><StatusBar />
      <header className="brand-lockup"><span className="eyebrow">HELLO, LITTLE STAR!</span><div className="brand-name">LUMI</div><p>和小鹿一起，开心学英语</p><LumiMascot size="large" /></header>
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

function HomePage({ onNavigate, checkInDays, hasCheckedIn, onCheckIn }: { onNavigate: (tab: StudentTab) => void; checkInDays: number; hasCheckedIn: boolean; onCheckIn: () => void }) {
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);
  const handleCheckIn = () => {
    if (hasCheckedIn) return;
    onCheckIn();
    setShowCheckInSuccess(true);
    window.setTimeout(() => setShowCheckInSuccess(false), 1800);
  };
  return (
    <StudentPage active="home" onNavigate={onNavigate} label="学生首页">
      <header className="student-header"><div className="avatar-tile"><LumiMascot size="small" /></div><div><p>GOOD MORNING!</p><h1>早上好，陈小鹿</h1></div><div className="checkin-wrap"><button className={hasCheckedIn ? "checkin-button checked" : "checkin-button"} type="button" onClick={handleCheckIn} aria-pressed={hasCheckedIn} aria-label={hasCheckedIn ? `今天已签到，连续 ${checkInDays} 天` : `点击签到，当前连续 ${checkInDays} 天`}><span>🔥</span><strong>{checkInDays}</strong><small>天</small></button>{showCheckInSuccess && <span className="checkin-success" role="status">签到成功！</span>}</div></header>
      <section className="welcome-card"><span className="welcome-star one">★</span><span className="welcome-star two">✦</span><div className="welcome-copy"><span className="tiny-label">TODAY&apos;S ADVENTURE</span><h2>今天也要勇敢<br />开口说英语！</h2><button type="button" onClick={() => onNavigate("learn")}>继续学习 <b>→</b></button></div><div className="mascot-spot"><LumiMascot size="large" /><span className="speech-dot">Hi!</span></div></section>
      <Card className="progress-strip"><div className="progress-ring"><strong>3</strong><span>/5</span></div><div><strong>今日任务已完成 3 个</strong><p>再完成 2 个，就能打开星星宝箱！</p><ProgressBar value={60} tone="mint" /></div><span className="treasure">🎁</span></Card>
      <SectionTitle eyebrow="TODAY" title="今天学什么" action="全部任务 →" onAction={() => onNavigate("learn")} />
      <div className="task-list">{todayTasks.map((task, index) => <TaskRow key={task.title} {...task} badge={index === 0 ? "推荐先学" : undefined} onClick={() => onNavigate(index === 1 ? "ai" : "learn")} />)}</div>
    </StudentPage>
  );
}

function LearnPage({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [view, setView] = useState<"home" | "catalog" | "player" | "complete">("home");
  const [step, setStep] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});

  const startAt = (index = 0) => {
    setStep(index);
    setSessionStart(index);
    setResults({});
    setView("player");
  };
  const finishStep = () => {
    setResults((items) => ({ ...items, [step]: items[step] ?? true }));
    if (step >= sampleLesson.activities.length - 1) setView("complete");
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
        <PageHeader eyebrow="TODAY&apos;S ADVENTURE" title="水果店大冒险" subtitle="和 Lumi 一路学到会" onBack={() => setView("home")} trailing={<Pill tone="yellow">⭐ +8</Pill>} />
        <LessonCourseCard lesson={sampleLesson} onStart={() => startAt(0)} />
        <SectionTitle eyebrow="ADVENTURE ROUTE" title="今天的冒险路线" />
        <div className="course-schema-list">{sampleLesson.activities.map((activity, index) => {
          const meta = activityCatalog.find((item) => item.type === activity.type) ?? activityCatalog[0];
          const detail = activity.type === "word" ? `认识 ${activity.word}` : activity.type === "sentence" ? `学会说：${activity.sentence}` : activity.type === "recall" ? activity.mode === "audio_to_text" ? "听声音，找到藏起来的句子" : activity.mode === "fill_blank" ? "补好水果店的句子招牌" : "想一想，把苹果卡片找出来" : activity.type === "pronunciation" ? `勇敢读出 ${activity.content}` : `在${activity.scene}完成英语对话`;
          return <button className="course-schema-row" type="button" key={`${activity.type}-${index}`} onClick={() => startAt(index)}><span>{meta.icon}</span><div><strong>{index + 1}. {meta.studentTitle}</strong><small>{detail}</small></div><b>出发 ›</b></button>;
        })}</div>
        <Card className="learning-note" tone="sky"><span>🦌</span><div><strong>Lumi 会一直陪着你</strong><p>每完成一个小挑战，就会离水果店和星星宝箱更近一点。</p></div></Card>
      </StudentPage>
    );
  }

  if (view === "player") {
    const activity = sampleLesson.activities[step];
    const meta = activityCatalog.find((item) => item.type === activity.type) ?? activityCatalog[0];
    return (
      <StudentPage active="learn" onNavigate={onNavigate} label={`${meta.studentTitle}页面`} hideNav>
        <header className="lesson-focus-header">
          <button type="button" onClick={() => setView("catalog")} aria-label="退出当前课程">×</button>
          <div><span>LUMI ADVENTURE</span><strong>水果店大冒险</strong></div>
          <Pill tone="yellow">⭐ 126</Pill>
        </header>
        <LessonActivityView
          activity={activity}
          step={step}
          total={sampleLesson.activities.length}
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
      <PageHeader eyebrow="LEARNING GARDEN" title="学习乐园" subtitle="每天一点点，英语棒棒哒" trailing={<Pill tone="yellow">⭐ 126</Pill>} />
      <div className="learning-overview">
        <Card className="learning-summary-strip"><div><span>TODAY&apos;S ADVENTURE</span><strong>水果店大冒险</strong><p>8 个小挑战 · 一路闯到水果店</p></div><Button onClick={() => setView("catalog")}>看看路线</Button></Card>
      </div>
    </StudentPage>
  );
}

function AiPage({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const busyRef = useRef(false); // 防连点竞态 (state 更新是异步的)
  const recordingRef = useRef<{ stop: () => Uint8Array } | null>(null); // 麦克风录音句柄 (AI 伙伴语音输入)
  const [messages, setMessages] = useState([
    { role: "lumi", text: "Hi，小鹿！今天想聊动物、学校，还是听一个英语故事？", translation: "嗨，小鹿！选择一个你喜欢的话题吧。" },
  ]);

  // 发给后端 AI, 等它回 (英文 + 中文翻译)
  const sendMessage = async (text: string) => {
    const value = text.trim();
    if (!value || busyRef.current) return;
    const nextMessages = [...messages, { role: "student", text: value, translation: "" }];
    setMessages(nextMessages);
    setInput("");
    busyRef.current = true;
    setIsWaiting(true);
    try {
      const history = nextMessages.map((m) => ({
        role: m.role === "lumi" ? "assistant" : "user",
        content: m.text,
      }));
      const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error(`AI 接口错误: ${res.status}`);
      const data = await res.json();
      setMessages((items) => [...items, {
        role: "lumi",
        text: data.english || "Hmm, I did not get that. Can you say it again?",
        translation: data.translation || "",
      }]);
    } catch (err) {
      console.error("AI chat error:", err);
      setMessages((items) => [...items, {
        role: "lumi",
        text: "Oops, my network is sleepy. Please try again!",
        translation: "哎呀，网络开小差了，再试一次好吗？",
      }]);
    } finally {
      busyRef.current = false;
      setIsWaiting(false);
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); sendMessage(input); };

  // 用后端 TTS 把 Lumi 的英文回复读出来
  const playTTS = async (text: string) => {
    const clean = (text || "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!clean) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/tts/synthesize?text=${encodeURIComponent(clean)}&fmt=mp3`, { method: "POST" });
      if (!res.ok) throw new Error(`TTS 错误: ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      console.error("TTS playback error:", err);
    }
  };

  // ---------- 语音转文字 (录音 → 后端阿里云 ASR) ----------

  // 🎙 按钮: 第一次按开始录, 再按一次停止并转文字发出去
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
        const trimmed = text.trim();
        if (trimmed) { setInput(trimmed); await sendMessage(trimmed); }
      } catch (err) {
        console.error("STT error:", err);
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
  return (
    <StudentPage active="ai" onNavigate={onNavigate} label="AI英语伙伴页面">
      <div className="ai-page-layout"><PageHeader eyebrow="LUMI AI BUDDY" title="AI 英语伙伴" subtitle="安全陪伴模式已开启" trailing={<Pill tone="mint">● 在线</Pill>} />
        <Card className="ai-companion-card" tone="violet"><LumiMascot size="medium" /><div><strong>Lumi 在这里</strong><p>可以说中文，也可以试试英语。说错没关系，我会给你小提示。</p></div><span>✨</span></Card>
        <div className="chat-list" aria-live="polite">{messages.map((message, index) => <div className={`chat-row ${message.role}`} key={`${message.role}-${index}`}>{message.role === "lumi" && <span className="mini-ai">AI</span>}<div className="chat-bubble"><strong>{message.text}</strong>{message.translation && <small>{message.translation}</small>}{message.role === "lumi" && <button type="button" aria-label="播放回答" onClick={() => playTTS(message.text)}>▶ 听一听</button>}</div></div>)}{isWaiting && <div className="chat-row lumi"><span className="mini-ai">AI</span><div className="chat-bubble typing" aria-label="Lumi 正在输入"><strong>正在想…</strong></div></div>}</div>
        <div className="quick-prompts" aria-label="快捷提问">{["我想聊动物", "讲个小故事", "陪我练口语"].map((text) => <button key={text} type="button" onClick={() => sendMessage(text)}>{text}</button>)}</div>
        <p className="safety-caption">Lumi 只回答适合儿童的英语学习内容，重要问题请询问老师或家长。</p>
        <form className="chat-composer" onSubmit={submit}><button className={listening ? "voice-button listening" : "voice-button"} type="button" aria-label="语音输入" onClick={handleVoice}>{listening ? "◼" : "🎙"}</button><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={listening ? "正在听你说…" : "输入想问的问题"} aria-label="向Lumi提问" /><button className="send-button" type="submit" aria-label="发送消息" disabled={isWaiting}>↑</button></form>
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

export default function Home() {
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
