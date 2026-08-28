/**
 * UI 原语复刻层：对应队友分支 components/student-ui.tsx + student-ui.css（经典童趣主题）。
 * 颜色/尺寸忠实照搬 H5 的 class 定义；小鹿吉祥物用 View 绝对定位复刻。
 */
import { ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DomLumiMascot from "./mascot/LumiMascot.dom";

/* ---- 调色板（classic 主题 tokens） ---- */
export const P = {
  violet: "#6257e8",
  violetDeep: "#312b83",
  violetSoft: "#efedff",
  sky: "#75c8f8",
  mint: "#43c9b7",
  sun: "#ffd861",
  coral: "#ff8296",
  ink: "#1f2942",
  muted: "#7c869e",
  line: "#e8eaf3",
  surface: "#f7f8fc",
  body: "#eef1f8",
  white: "#ffffff",
};

export type Tone = "violet" | "mint" | "sky" | "yellow" | "pink" | "gray";

export const TONE_SOFT: Record<Tone, { fg: string; bg: string }> = {
  violet: { fg: P.violet, bg: P.violetSoft },
  mint: { fg: "#138675", bg: "#dff8f3" },
  sky: { fg: "#217fac", bg: "#def3ff" },
  yellow: { fg: "#9a6a0b", bg: "#fff3c8" },
  pink: { fg: "#d9586d", bg: "#ffe5ea" },
  gray: { fg: "#81899c", bg: "#eff1f5" },
};

const FILL_GRAD: Record<string, [string, string]> = {
  violet: ["#665cec", "#938bf9"],
  mint: ["#26b9a5", "#6bdfcf"],
  sky: ["#56b8ee", "#99dbff"],
  yellow: ["#f2bd37", "#ffdd72"],
  pink: ["#f56f86", "#ffa1b0"],
};

export const CARD_SHADOW = { elevation: 3, shadowColor: "#2b3151", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } };

/* ---- 手机壳骨架 ---- */
/** fill=撑满视口（学生主页类页面）；fit=按内容自适应、垂直水平居中（登录/身份页），对应原版 .stage/.phone-shell 的表现 */
export function PhoneShell({ children, testID, mode = "fill" }: { children: ReactNode; testID?: string; mode?: "fill" | "fit" }) {
  return (
    <View style={[styles.bodyBg, mode === "fit" && { paddingVertical: 24 }]}>
      <View style={[styles.shell, mode === "fill" && { flex: 1 }, mode === "fit" && { flex: 0, maxHeight: 880 }]}>
        {children}
      </View>
    </View>
  );
}

export function StatusBar() {
  return (
    <View style={styles.statusRow}>
      <Text style={{ fontSize: 11, fontWeight: "900", color: P.ink }}>9:41</Text>
      <Text style={{ fontSize: 11, fontWeight: "900", color: P.ink }}>● ●</Text>
    </View>
  );
}

export function FloatingDecorations() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Text style={[styles.sparkle, { top: 82, left: 28 }]}>✦</Text>
      <Text style={[styles.sparkle, { top: 160, right: 31, fontSize: 17, color: "#a99fff" }]}>★</Text>
      <View style={[{ position: "absolute", top: 120, right: -25, width: 82, height: 82, borderRadius: 41, backgroundColor: "rgba(117,200,248,.16)" }]} />
      <View style={[{ position: "absolute", bottom: 120, left: -28, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,130,150,.1)" }]} />
    </View>
  );
}

/* ---- Lumi 小熊吉祥物 ---- */
export type LumiMood = "neutral" | "happy" | "encourage" | "curious" | "listening" | "resting" | "proud";
type MascotSize = "small" | "medium" | "large";
export type MascotVariant = "head" | "full";

const MOOD_LABEL: Record<LumiMood, string> = {
  neutral: "Lumi 小熊吉祥物",
  happy: "开心跳起来庆祝的 Lumi 小熊",
  encourage: "点头为你加油的 Lumi 小熊",
  curious: "歪着头等你回答的 Lumi 小熊",
  listening: "竖起耳朵认真听的 Lumi 小熊",
  resting: "陪你慢慢休息的 Lumi 小熊",
  proud: "为完成任务骄傲庆祝的 Lumi 小熊",
};

const SIZE_CFG: Record<MascotSize, { w: number; h: number; bw: number; earBw: number; antler: number }> = {
  small: { w: 54, h: 49, bw: 3, earBw: 2, antler: 13 },
  medium: { w: 82, h: 74, bw: 4, earBw: 4, antler: 19 },
  large: { w: 112, h: 100, bw: 5, earBw: 5, antler: 26 },
};

function useMoodLoop(mood: LumiMood) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (mood === "neutral" || mood === "encourage" || mood === "resting") {
      // 轻轻上下浮
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
    } else if (mood === "listening") {
      // 左右摆 + 微升
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 2, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
    }
    loop?.start();
    return () => loop?.stop();
  }, [mood, v]);
  const jumpY = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -4, 0] });
  const sway = v.interpolate({ inputRange: [0, 1, 2], outputRange: ["-2deg", "0deg", "2deg"] });
  const transform: ViewStyle["transform"] =
    mood === "listening"
      ? [{ translateY: 4 }, { rotate: sway }]
      : [{ translateY: jumpY }];
  return { transform };
}

/** Web 使用原始 SVG；原生端由 Expo DOM 内嵌同一份角色。 */
export function LumiMascot({ size = "medium", mood = "neutral", variant = "head" }: { size?: MascotSize; mood?: LumiMood; variant?: MascotVariant }) {
  const fullSize = { small: { w: 78, h: 96 }, medium: { w: 128, h: 158 }, large: { w: 190, h: 234 } }[size];
  const domSize = variant === "full" ? fullSize : { w: SIZE_CFG[size].w, h: SIZE_CFG[size].w };
  return (
    <DomLumiMascot
      size={size}
      mood={mood}
      variant={variant}
      dom={{ scrollEnabled: false, style: { width: domSize.w, height: domSize.h } }}
    />
  );
}

/** 旧手绘近似版保留备用（不再被页面引用）；后续确认原生 WebView 方案稳定后可整体删除。 */
function LumiMascotLegacy({ size = "medium", mood = "neutral" }: { size?: MascotSize; mood?: LumiMood }) {
  const s = SIZE_CFG[size];
  const anim = useMoodLoop(mood);
  const earBg = mood === "listening" ? "#9f96ff" : "#b7b0ff";
  const isCheerful = mood === "happy" || mood === "proud";
  return (
    <Animated.View accessibilityRole="image" accessibilityLabel={MOOD_LABEL[mood]} style={{ width: s.w, height: s.h, ...anim }}>
      {/* 身体 */}
      <LinearGradient colors={["#c9c4ff", "#aaa2ff"]} style={[mascotBodyStyle(s), { borderWidth: s.bw }, isCheerful && { transform: [{ scale: 1.04 }] }]}>
        {/* 耳朵 */}
        <View style={pos("left", -0.15 * s.w - 4, 0.05 * s.h, 0.28 * s.w, 0.38 * s.h)} >
          <View style={[earShape(s.earBw, earBg, "-34deg"), { borderTopRightRadius: 0 }]} />
        </View>
        <View style={pos("right", -0.15 * s.w - 4, 0.05 * s.h, 0.28 * s.w, 0.38 * s.h)}>
          <View style={[earShape(s.earBw, earBg, "34deg"), { borderTopLeftRadius: 0 }]} />
        </View>
        {/* 角 */}
        <Text style={{ position: "absolute", top: -0.24 * s.h, left: "16%", color: "#7b71dd", fontWeight: "900", fontSize: s.antler, transform: [{ rotate: "-18deg" }] }}>Y</Text>
        <Text style={{ position: "absolute", top: -0.24 * s.h, right: "16%", color: "#7b71dd", fontWeight: "900", fontSize: s.antler, transform: [{ rotate: "18deg" }] }}>Y</Text>
        {/* 手臂 */}
        <View style={[armStyle(s.h, true), { borderWidth: Math.max(2, s.bw - 2) }]} />
        <View style={[armStyle(s.h, false), { borderWidth: Math.max(2, s.bw - 2) }]} />
        {/* 眼睛 */}
        <View style={eyeStyle(mood, false, s.h)} />
        <View style={eyeStyle(mood, true, s.h)} />
        {/* 腮红 */}
        <View style={cheekStyle(mood, false)} />
        <View style={cheekStyle(mood, true)} />
        {/* 嘴 */}
        <View style={smileStyle(mood)} />
        {/* 徽章类装饰 */}
        {(mood === "listening") && <Text style={{ position: "absolute", right: -0.24 * s.w, top: "7%", color: P.violet, fontWeight: "900", fontSize: 15 }}>♪</Text>}
        {(mood === "resting") && <Text style={{ position: "absolute", right: -0.17 * s.w, top: -0.2 * s.h, color: "#8c86c4", fontWeight: "900", fontSize: 14 }}>z</Text>}
        {(mood === "proud") && (
          <View style={{ position: "absolute", left: "34%", bottom: -0.17 * s.h, width: "32%", height: "32%", borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: P.sun, borderWidth: 2, borderColor: "#fff" }}>
            <Text style={{ fontSize: 9, color: "#9b6a09", fontWeight: "900" }}>★</Text>
          </View>
        )}
        {isCheerful && (
          <>
            <Text style={{ position: "absolute", left: -0.2 * s.w, top: -0.22 * s.h, color: P.sun, fontWeight: "900", fontSize: 15 }}>★</Text>
            <Text style={{ position: "absolute", right: -0.22 * s.w, top: -0.05 * s.h, color: "#8f84f2", fontWeight: "900", fontSize: 13 }}>✦</Text>
            <Text style={{ position: "absolute", right: -0.12 * s.w, bottom: -0.1 * s.h, color: P.mint, fontWeight: "900", fontSize: 9 }}>●</Text>
          </>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

function pos(side: "left" | "right", offset: number, top: number, w: number, h: number): ViewStyle {
  return { position: "absolute", top, width: w, height: h, zIndex: -1 };
}
function mascotBodyStyle(s: { w: number; h: number }): ViewStyle {
  return {
    flex: 1,
    borderRadius: Math.round(Math.min(s.w, s.h) * 0.44),
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.violet,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  };
}
function armStyle(h: number, left: boolean): ViewStyle {
  void h;
  return {
    position: "absolute",
    bottom: "8%",
    ...(left ? { left: "-13%" } : { right: "-13%" }),
    width: "25%",
    height: "11%",
    borderRadius: 99,
    backgroundColor: "#aaa2ff",
    transform: [{ rotate: left ? "28deg" : "-28deg" }],
  };
}
function earShape(bw: number, bg: string, deg: string): ViewStyle {
  return {
    flex: 1,
    backgroundColor: bg,
    borderWidth: bw,
    borderColor: "#fff",
    borderBottomLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
    transform: [{ rotate: deg }],
  };
}
function eyeStyle(mood: LumiMood, right: boolean, h: number): ViewStyle {
  void h;
  return {
    position: "absolute",
    top: "39%",
    ...(right ? { right: "28%" } : { left: "28%" }),
    width: "8%",
    height: mood === "resting" ? 3 : isHappyEye(mood) ? "7%" : "12%",
    borderRadius: mood === "resting" ? 99 : isHappyEye(mood) ? 6 : 99,
    backgroundColor: P.violetDeep,
    transform: isHappyEye(mood) ? [{ translateY: 2 }] : [],
  };
}
function isHappyEye(mood: LumiMood) {
  return mood === "happy" || mood === "proud" || mood === "encourage";
}
function cheekStyle(mood: LumiMood, right: boolean): ViewStyle {
  return {
    position: "absolute",
    top: "58%",
    ...(right ? { right: "15%" } : { left: "15%" }),
    width: mood === "encourage" ? "18%" : "15%",
    height: "8%",
    borderRadius: 99,
    backgroundColor: mood === "encourage" ? "rgba(255,130,150,.62)" : "rgba(255,130,150,.44)",
  };
}
function smileStyle(mood: LumiMood): ViewStyle {
  const happyArc = isHappyEye(mood);
  const geo: ViewStyle =
    mood === "curious" ? { left: "42%", top: "56%", width: "16%", height: "8%" }
    : mood === "resting" ? { left: "39%", top: "59%", width: "22%", height: "9%" }
    : happyArc ? { left: "39%", top: "55%", width: "22%", height: "20%" }
    : { left: "39%", top: "58%", width: "22%", height: "14%" };
  return {
    position: "absolute",
    ...geo,
    borderBottomWidth: 3,
    borderBottomColor: P.violetDeep,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  };
}

/* ---- 按钮 / 卡片 / 徽章 / 进度 ---- */
export function Button({ children, variant = "primary", onPress, disabled, style }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost"; onPress?: () => void; disabled?: boolean; style?: ViewStyle }) {
  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ opacity: disabled ? 0.38 : pressed ? 0.92 : 1 }]}>
        <LinearGradient colors={["#7168f2", "#5549dc"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btnBase, CARD_SHADOW, style]}>
          <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>{children}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  const secondary = variant === "secondary";
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      styles.btnBase,
      style,
      { backgroundColor: secondary ? P.violetSoft : "transparent", opacity: disabled ? 0.38 : pressed ? 0.85 : 1 },
    ]}>
      <Text style={{ color: P.violet, fontWeight: "800", textAlign: "center" }}>{children}</Text>
    </Pressable>
  );
}

export function Card({ children, tone, style }: { children: ReactNode; tone?: Tone; style?: ViewStyle }) {
  const toneBg: Partial<Record<Tone, { bg: string; border: string }>> = {
    violet: { bg: "#f8f7ff", border: "#e5e1ff" },
    mint: { bg: "#edfbf8", border: "#d7f4ee" },
    sky: { bg: "#eef9ff", border: "#d9f0fd" },
    yellow: { bg: "#fff9e3", border: "#f9edbd" },
    pink: { bg: "#fff1f3", border: "#ffe0e5" },
  };
  const t = tone ? toneBg[tone] : undefined;
  return (
    <View style={[styles.card, CARD_SHADOW, t && { backgroundColor: t.bg, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function Pill({ children, tone = "violet" }: { children: ReactNode; tone?: Tone }) {
  const t = TONE_SOFT[tone];
  return (
    <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", minHeight: 24, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: t.bg }}>
      <Text style={{ color: t.fg, fontSize: 9, fontWeight: "900" }}>{children}</Text>
    </View>
  );
}

export function ProgressBar({ value, tone = "violet" }: { value: number; tone?: Tone }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressRail}>
      <View style={{ width: `${v}%`, height: "100%", borderRadius: 99, overflow: "hidden" }}>
        <LinearGradient colors={FILL_GRAD[tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/* ---- 页头 / 标题 / 任务行 ---- */
export function PageHeader({ eyebrow, title, subtitle, trailing, onBack }: { eyebrow?: string; title: string; subtitle?: string; trailing?: ReactNode; onBack?: () => void }) {
  return (
    <View style={styles.pageHeader}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={{ color: P.violet, fontSize: 24, marginTop: -4 }}>‹</Text>
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.h1}>{title}</Text>
        {!!subtitle && <Text style={{ color: P.muted, fontSize: 10, marginTop: 4 }}>{subtitle}</Text>}
      </View>
      {trailing && <View>{trailing}</View>}
    </View>
  );
}

export function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <View>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={{ fontSize: 17, fontWeight: "900", color: P.ink, marginTop: 2 }}>{title}</Text>
      </View>
      {!!action && (
        <Pressable onPress={onAction}><Text style={{ color: P.violet, fontSize: 10, fontWeight: "900" }}>{action}</Text></Pressable>
      )}
    </View>
  );
}

export function TaskRow({ icon, title, detail, meta, reward, tone = "violet", badge, onPress }: { icon: string; title: string; detail: string; meta?: string; reward?: string; tone?: Tone; badge?: string; onPress?: () => void }) {
  const t = TONE_SOFT[tone];
  return (
    <Pressable onPress={onPress} style={styles.taskRow}>
      <View style={[{ width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" }, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.fg, fontWeight: "900", fontSize: 14 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: "900", color: P.ink }}>{title}</Text>
        <Text style={{ fontSize: 9, color: P.muted }}>{detail}</Text>
        {!!meta && <Text style={{ fontSize: 8, color: "#a1a7b5" }}>{meta}</Text>}
      </View>
      {!!reward && <Pill tone="yellow">{reward}</Pill>}
      <View style={styles.rowArrow}><Text style={{ color: P.violet, fontSize: 17 }}>›</Text></View>
      {!!badge && <View style={styles.cornerBadge}><Text style={{ color: "#fff", fontSize: 7, fontWeight: "900" }}>{badge}</Text></View>}
    </Pressable>
  );
}

/* ---- 底部导航 + 学生页容器 ---- */
export type StudentTab = "home" | "learn" | "ai" | "homework" | "growth";
const NAV_ITEMS: Array<{ id: StudentTab; icon: string; label: string }> = [
  { id: "home", icon: "⌂", label: "首页" },
  { id: "learn", icon: "Ab", label: "学习" },
  { id: "ai", icon: "AI", label: "AI伙伴" },
  { id: "homework", icon: "✓", label: "作业" },
  { id: "growth", icon: "我", label: "成长" },
];

export function BottomNav({ active, onChange }: { active: StudentTab; onChange: (id: StudentTab) => void }) {
  return (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => {
        const selected = active === item.id;
        return (
          <Pressable key={item.id} onPress={() => onChange(item.id)} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8 }}>
            {item.id === "ai" ? (
              <View style={styles.navAiCircle}><Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>AI</Text></View>
            ) : (
              <>
                <Text style={{ fontSize: 13, fontWeight: "900", color: selected ? P.violet : "#9299aa" }}>{item.icon}</Text>
                {selected && <View style={{ width: 18, height: 3, borderRadius: 99, backgroundColor: P.violet }} />}
              </>
            )}
            <Text style={{ fontSize: 8, fontWeight: item.id === "ai" ? "400" : "800", color: selected ? P.violet : "#9299aa" }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StudentPage({ children, active, onNavigate, hideNav = false }: { children: ReactNode; active: StudentTab; onNavigate: (tab: StudentTab) => void; hideNav?: boolean }) {
  return (
    <PhoneShell>
      <StatusBar />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {!hideNav && <BottomNav active={active} onChange={onNavigate} />}
    </PhoneShell>
  );
}

const styles = StyleSheet.create({
  bodyBg: { flex: 1, backgroundColor: P.body, alignItems: "center", justifyContent: "center" },
  shell: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center", backgroundColor: P.surface, borderRadius: 36, borderWidth: 1, borderColor: "rgba(218,221,233,.9)", overflow: "hidden" },
  statusRow: { height: 42, paddingHorizontal: 24, paddingTop: 17, flexDirection: "row", justifyContent: "space-between" },
  sparkle: { position: "absolute", color: P.sun, fontSize: 22, transform: [{ rotate: "-14deg" }] },
  card: { backgroundColor: "#fff", borderRadius: 21, borderWidth: 1, borderColor: "#eef0f6", padding: 14 },
  btnBase: { minHeight: 48, borderRadius: 15, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  progressRail: { width: "100%", height: 7, borderRadius: 99, backgroundColor: "#e9ebf2", overflow: "hidden" },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 10, paddingBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: P.violetSoft, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: P.violet, fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  h1: { fontSize: 23, fontWeight: "900", color: P.ink, marginTop: 2 },
  sectionTitle: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginVertical: 21, marginTop: 21, marginBottom: 11 },
  taskRow: { position: "relative", width: "100%", minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: "#f0f1f6", borderRadius: 19, padding: 11, backgroundColor: "#fff", marginBottom: 10 },
  rowArrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: P.violetSoft, alignItems: "center", justifyContent: "center" },
  cornerBadge: { position: "absolute", right: 10, top: -7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: P.coral },
  bottomNav: { height: 71, flexDirection: "row", borderTopWidth: 1, borderTopColor: P.line, backgroundColor: "rgba(255,255,255,.97)" },
  navAiCircle: { width: 31, height: 31, marginTop: -11, borderRadius: 16, borderWidth: 4, borderColor: "#fff", backgroundColor: P.violet, alignItems: "center", justifyContent: "center", shadowColor: P.violet, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
});
