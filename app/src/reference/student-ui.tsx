import type { ButtonHTMLAttributes, ReactNode } from "react";

export type StudentTab = "home" | "ai" | "homework" | "growth";
export type Tone = "violet" | "mint" | "sky" | "yellow" | "pink" | "gray";
export type LumiMood = "neutral" | "happy" | "encourage" | "curious" | "listening" | "resting" | "proud";
export type LumiVariant = "head" | "full";

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
  neutral: "Lumi 小熊吉祥物",
  happy: "开心跳起来庆祝的 Lumi 小熊",
  encourage: "点头为你加油的 Lumi 小熊",
  curious: "歪着头等你回答的 Lumi 小熊",
  listening: "竖起耳朵认真听的 Lumi 小熊",
  resting: "陪你慢慢休息的 Lumi 小熊",
  proud: "为完成任务骄傲庆祝的 Lumi 小熊",
};

export function LumiMascot({ size = "medium", mood = "neutral", variant = "head" }: { size?: "small" | "medium" | "large"; mood?: LumiMood; variant?: LumiVariant }) {
  return (
    <div className={`bear-mascot ${size} variant-${variant} mood-${mood}`} role="img" aria-label={lumiMoodLabels[mood]}>
      <svg viewBox={variant === "full" ? "54 28 252 334" : "54 34 252 226"} aria-hidden="true">
        <defs>
          <linearGradient id="lumiBearFur" x1="88" y1="58" x2="255" y2="236" gradientUnits="userSpaceOnUse"><stop stopColor="#FFD08B" /><stop offset=".48" stopColor="#EDA85E" /><stop offset="1" stopColor="#C97834" /></linearGradient>
          <linearGradient id="lumiBearBody" x1="150" y1="242" x2="211" y2="348" gradientUnits="userSpaceOnUse"><stop stopColor="#F4B96D" /><stop offset="1" stopColor="#C97834" /></linearGradient>
          <linearGradient id="lumiBearCream" x1="154" y1="170" x2="205" y2="225" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#F4DDB8" /></linearGradient>
        </defs>
        <g className="bear-root">
          {variant === "full" && <>
            <ellipse className="bear-shadow" cx="180" cy="354" rx="82" ry="12" fill="#513323" opacity=".08" />
            <g className="bear-arm bear-arm-left" transform="translate(128 254)"><path d="M-7-5C-18 4-19 31-10 48C-6 56 7 57 12 48C20 32 17 6 7-5Z" fill="url(#lumiBearBody)" stroke="#513323" strokeWidth="4" strokeLinejoin="round" /><ellipse cx="1" cy="44" rx="8.5" ry="7" fill="url(#lumiBearCream)" /></g>
            <g className="bear-arm bear-arm-right" transform="translate(232 254)"><path d="M-7-5C-18 4-19 31-10 48C-6 56 7 57 12 48C20 32 17 6 7-5Z" fill="url(#lumiBearBody)" stroke="#513323" strokeWidth="4" strokeLinejoin="round" /><ellipse cx="1" cy="44" rx="8.5" ry="7" fill="url(#lumiBearCream)" /></g>
            <g className="bear-body"><path d="M180 232C142 232 119 256 120 292C121 326 143 343 180 343C217 343 239 326 240 292C241 256 218 232 180 232Z" fill="url(#lumiBearBody)" stroke="#513323" strokeWidth="4.2" strokeLinejoin="round" /><path d="M180 252C154 252 139 270 141 299C143 322 158 335 180 335C202 335 217 322 219 299C221 270 206 252 180 252Z" fill="url(#lumiBearCream)" stroke="#F4DDB8" strokeWidth="2.2" opacity=".94" /><ellipse cx="166" cy="274" rx="18" ry="10" fill="#fff" opacity=".24" /><path d="M131 337C136 325 158 323 171 334C178 340 170 351 154 353C138 355 126 348 131 337Z" fill="#C97834" stroke="#513323" strokeWidth="4" /><path d="M229 337C224 325 202 323 189 334C182 340 190 351 206 353C222 355 234 348 229 337Z" fill="#C97834" stroke="#513323" strokeWidth="4" /><ellipse cx="151" cy="340" rx="12.5" ry="6.5" fill="#FFF8E9" /><ellipse cx="209" cy="340" rx="12.5" ry="6.5" fill="#FFF8E9" /></g>
          </>}
          <g className="bear-head"><g className="bear-nod">
            <g className="bear-ear bear-ear-left" transform="translate(106 74)"><ellipse rx="34" ry="35" fill="url(#lumiBearFur)" stroke="#513323" strokeWidth="4.2" /><ellipse cx="3" cy="6" rx="18" ry="19" fill="#F4B49F" /><ellipse cy="2" rx="11" ry="12" fill="#FFF8E9" opacity=".42" /></g>
            <g className="bear-ear bear-ear-right" transform="translate(254 74)"><ellipse rx="34" ry="35" fill="url(#lumiBearFur)" stroke="#513323" strokeWidth="4.2" /><ellipse cx="-3" cy="6" rx="18" ry="19" fill="#F4B49F" /><ellipse cy="2" rx="11" ry="12" fill="#FFF8E9" opacity=".42" /></g>
            <path d="M180 51C122 51 82 84 76 137C70 190 106 232 158 242C172 245 188 245 202 242C254 232 290 190 284 137C278 84 238 51 180 51Z" fill="url(#lumiBearFur)" stroke="#513323" strokeWidth="4.6" strokeLinejoin="round" /><path d="M145 65C158 52 168 49 180 58C190 47 201 52 211 66" stroke="#FFE0A7" strokeWidth="8" strokeLinecap="round" fill="none" opacity=".65" /><path d="M162 58Q169 41 180 57Q190 40 198 59" stroke="#513323" strokeWidth="4" strokeLinecap="round" fill="none" />
            {mood === "proud" && <g className="bear-party-hat" transform="translate(184 56) rotate(14)"><path d="M-36 16L32 24L0-48Z" fill="#FF8FA3" stroke="#513323" strokeWidth="4.5" strokeLinejoin="round" /><circle cx="-8" cy="6" r="4" fill="#FFF8E9" /><circle cx="8" cy="10" r="3.4" fill="#FFF8E9" /><circle cx="-2" cy="-14" r="4" fill="#FFF8E9" /><circle cy="-48" r="9" fill="#FFCF4D" stroke="#F0A51F" strokeWidth="3.5" /></g>}
            <path d="M180 158C151 158 134 174 136 197C138 219 158 230 180 230C202 230 222 219 224 197C226 174 209 158 180 158Z" fill="url(#lumiBearCream)" stroke="#F4DDB8" strokeWidth="2.2" /><ellipse cx="166" cy="174" rx="22" ry="10" fill="#fff" opacity=".2" />
            <ellipse className="bear-cheek" cx="116" cy="184" rx="17" ry="10.5" fill="#F58F91" /><ellipse className="bear-cheek" cx="244" cy="184" rx="17" ry="10.5" fill="#F58F91" />
            <g className="bear-open-eyes"><g className="bear-eye bear-eye-left" transform="translate(144 142)"><circle className="bear-pupil" r="13.5" fill="#513323" /><circle cx="-4.6" cy="-4.8" r="4.8" fill="#fff" /><circle cx="3.8" cy="3" r="2.2" fill="#fff" opacity=".88" /></g><g className="bear-eye bear-eye-right" transform="translate(216 142)"><circle className="bear-pupil" r="13.5" fill="#513323" /><circle cx="-4.6" cy="-4.8" r="4.8" fill="#fff" /><circle cx="3.8" cy="3" r="2.2" fill="#fff" opacity=".88" /></g></g>
            <g className="bear-happy-eyes" stroke="#513323" strokeWidth="5.5" strokeLinecap="round" fill="none"><path d="M131 143Q144 130 157 143" /><path d="M203 143Q216 130 229 143" /></g>
            <g className="bear-brows" stroke="#513323" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8"><path className="bear-brow-left" d="M130 116Q144 107 158 116" /><path className="bear-brow-right" d="M202 116Q216 107 230 116" /></g>
            <path d="M168 175C170 168 190 168 192 175C193 182 186 187 180 188C174 187 167 182 168 175Z" fill="#513323" /><ellipse cx="176" cy="173.5" rx="3.2" ry="2.3" fill="#fff" opacity=".78" />
            <path className="bear-mouth-normal" d="M166 194Q180 204 194 194" stroke="#513323" strokeWidth="4.5" fill="none" strokeLinecap="round" /><ellipse className="bear-mouth-curious" cx="180" cy="198" rx="5.5" ry="7" fill="#513323" /><path className="bear-mouth-happy" d="M162 192Q180 210 198 192Q180 199 162 192Z" fill="#513323" /><g className="bear-mouth-proud"><path d="M161 188Q180 218 199 188Q180 197 161 188Z" fill="#513323" /><path d="M171 202Q180 212 189 202Q180 205 171 202Z" fill="#F58585" /></g>
          </g></g>
        </g>
        {mood === "curious" && <g className="bear-thoughts" fill="#FFF3DC" stroke="#4A2E1C" strokeWidth="4"><circle cx="274" cy="90" r="7" /><circle cx="293" cy="68" r="11" /><circle cx="318" cy="42" r="16" /></g>}
        {mood === "listening" && <text className="bear-note" x="286" y="94" fill="#665CEC" fontSize="30" fontWeight="900">♪</text>}
        {mood === "resting" && <text className="bear-rest" x="282" y="85" fill="#8C86C4" fontSize="25" fontWeight="900">z</text>}
        {mood === "proud" && <g className="bear-stars" fill="#FFCF4D" stroke="#F0A51F" strokeWidth="2"><path className="bear-star" d="M44 80l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" /><path className="bear-star" d="M299 117l4 8 9 1-7 7 2 9-8-4-8 4 2-9-7-7 9-1z" /></g>}
      </svg>
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

type NavIconName = "home" | "ai" | "homework" | "profile";

const navItems: Array<{ id: StudentTab; icon: NavIconName; label: string }> = [
  { id: "home", icon: "home", label: "冒险" },
  { id: "ai", icon: "ai", label: "AI伙伴" },
  { id: "homework", icon: "homework", label: "作业" },
  { id: "growth", icon: "profile", label: "我的" },
];

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "home") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" /><path d="M6 5h10l-2.2 3L16 11H6" /><path d="M8.5 20c1.3-3.5 4.2-4 7-5.5" /><circle cx="17.5" cy="13" r="1.5" /></svg>;
  }
  if (name === "ai") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8Z" fill="currentColor" stroke="none" /><path d="m19 14 .6 2.2L22 17l-2.4.8L19 20l-.6-2.2L16 17l2.4-.8Z" fill="currentColor" stroke="none" /><path d="M5 14.5 5.6 17 8 18l-2.4 1L5 21.5 4.4 19 2 18l2.4-1Z" fill="currentColor" stroke="none" /></svg>;
  }
  if (name === "homework") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5h8" /><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="m8.3 13 2.2 2.2 5.2-5.2M8 8.5h5" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.8-3.7 3-5.6 6.5-5.6s5.7 1.9 6.5 5.6" /><path d="M18.5 5.5h2M19.5 4.5v2" /></svg>;
}

export function BottomNav({ active, onChange }: { active: StudentTab; onChange: (tab: StudentTab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="学生端主导航">
      {navItems.map((item) => <button key={item.id} className={active === item.id ? "selected" : ""} type="button" aria-label={item.label} aria-current={active === item.id ? "page" : undefined} onClick={() => onChange(item.id)}><span className={`nav-icon ${item.id === "ai" ? "nav-ai" : ""}`}><NavIcon name={item.icon} /></span><span className="nav-label" aria-hidden="true">{item.label}</span></button>)}
    </nav>
  );
}

export function StudentPage({ children, active, onNavigate, label, hideNav = false }: { children: ReactNode; active: StudentTab; onNavigate: (tab: StudentTab) => void; label: string; hideNav?: boolean }) {
  return <main className="stage"><PhoneShell label={label} className={`app-page ${hideNav ? "focused-page" : ""}`}><StatusBar /><div className="page-scroll-content">{children}</div>{!hideNav && <BottomNav active={active} onChange={onNavigate} />}</PhoneShell></main>;
}
