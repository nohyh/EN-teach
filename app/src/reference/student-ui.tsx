import type { ButtonHTMLAttributes, ReactNode } from "react";

export type StudentTab = "home" | "learn" | "ai" | "homework" | "growth";
export type Tone = "violet" | "mint" | "sky" | "yellow" | "pink" | "gray";
export type LumiMood = "neutral" | "happy" | "encourage" | "curious" | "listening" | "resting" | "proud";

export function PhoneShell({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return <section className={`phone-shell ${className}`} aria-label={label}>{children}</section>;
}

export function StatusBar() {
  return <div className="status-row" aria-hidden="true"><span>9:41</span><span>● ●</span></div>;
}

export function FloatingDecorations() {
  return <div className="floating-decorations" aria-hidden="true"><span className="sparkle sparkle-one">✦</span><span className="sparkle sparkle-two">★</span><span className="bubble bubble-one" /><span className="bubble bubble-two" /></div>;
}

const lumiMoodLabels: Record<LumiMood, string> = {
  neutral: "Lumi 小鹿吉祥物",
  happy: "开心跳起来庆祝的 Lumi 小鹿",
  encourage: "点头为你加油的 Lumi 小鹿",
  curious: "歪着头等你回答的 Lumi 小鹿",
  listening: "竖起耳朵认真听的 Lumi 小鹿",
  resting: "陪你慢慢休息的 Lumi 小鹿",
  proud: "为完成任务骄傲庆祝的 Lumi 小鹿",
};

export function LumiMascot({ size = "medium", mood = "neutral" }: { size?: "small" | "medium" | "large"; mood?: LumiMood }) {
  return (
    <div className={`lumi-mascot ${size} mood-${mood}`} role="img" aria-label={lumiMoodLabels[mood]}>
      <span className="lumi-ring" /><span className="lumi-pop pop-one">★</span><span className="lumi-pop pop-two">✦</span><span className="lumi-pop pop-three">●</span>
      <span className="ear left" /><span className="ear right" /><span className="antler left">Y</span><span className="antler right">Y</span><span className="eye left" /><span className="eye right" /><span className="cheek left" /><span className="cheek right" /><span className="smile" />
      <span className="lumi-arm left" /><span className="lumi-arm right" /><span className="lumi-signal">♪</span><span className="lumi-rest">z</span><span className="lumi-medal">★</span>
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <button className={`ui-button ${variant} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: Tone }) {
  return <section className={`ui-card ${tone ? `tone-${tone}` : ""} ${className}`}>{children}</section>;
}

export function Pill({ children, tone = "violet", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`ui-pill tone-${tone} ${className}`}>{children}</span>;
}

export function ProgressBar({ value, tone = "violet", label }: { value: number; tone?: Tone; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <div className="ui-progress" aria-label={label ?? `完成 ${safeValue}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span className={`tone-${tone}`} style={{ width: `${safeValue}%` }} /></div>;
}

export function PageHeader({ eyebrow, title, subtitle, trailing, onBack }: { eyebrow?: string; title: string; subtitle?: string; trailing?: ReactNode; onBack?: () => void }) {
  return (
    <header className="page-header">
      {onBack && <button type="button" className="back-button" aria-label="返回" onClick={onBack}>‹</button>}
      <div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {trailing && <div className="page-header-trailing">{trailing}</div>}
    </header>
  );
}

export function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="section-title"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action && <button type="button" onClick={onAction}>{action}</button>}</div>;
}

export function TaskRow({ icon, title, detail, meta, reward, tone = "violet", badge, onClick }: { icon: string; title: string; detail: string; meta?: string; reward?: string; tone?: Tone; badge?: string; onClick?: () => void }) {
  return (
    <button className="ui-task-row" type="button" onClick={onClick}>
      <span className={`ui-task-icon tone-${tone}`}>{icon}</span>
      <span className="ui-task-copy"><strong>{title}</strong><small>{detail}</small>{meta && <i>{meta}</i>}</span>
      {reward && <Pill tone="yellow">{reward}</Pill>}
      <span className="ui-row-arrow" aria-hidden="true">›</span>
      {badge && <span className="ui-corner-badge">{badge}</span>}
    </button>
  );
}

const navItems: Array<{ id: StudentTab; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "首页" },
  { id: "learn", icon: "Ab", label: "学习" },
  { id: "ai", icon: "AI", label: "AI伙伴" },
  { id: "homework", icon: "✓", label: "作业" },
  { id: "growth", icon: "我", label: "成长" },
];

export function BottomNav({ active, onChange }: { active: StudentTab; onChange: (tab: StudentTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="学生端主导航">
      {navItems.map((item) => <button key={item.id} className={active === item.id ? "selected" : ""} type="button" aria-current={active === item.id ? "page" : undefined} onClick={() => onChange(item.id)}><span className={item.id === "ai" ? "nav-ai" : ""}>{item.icon}</span>{item.label}</button>)}
    </nav>
  );
}

export function StudentPage({ children, active, onNavigate, label, hideNav = false }: { children: ReactNode; active: StudentTab; onNavigate: (tab: StudentTab) => void; label: string; hideNav?: boolean }) {
  return <main className="stage"><PhoneShell label={label} className={`app-page ${hideNav ? "focused-page" : ""}`}><StatusBar /><div className="page-scroll-content">{children}</div>{!hideNav && <BottomNav active={active} onChange={onNavigate} />}</PhoneShell></main>;
}


