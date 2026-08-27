"use dom";

/**
 * ★ 直接复用队友分支的原始小鹿：结构与类名 1:1 复刻自
 * feature/lumi-student-ui/components/student-ui.tsx 的 LumiMascot，
 * 样式原样来自 components/student-ui.css + app/globals.css 变量（见同目录 lumi.css）。
 * 未做任何视觉改动——之前那版手绘近似已废弃。
 */

import "./lumi.css";

export type LumiMoodDom =
  | "neutral"
  | "happy"
  | "encourage"
  | "curious"
  | "listening"
  | "resting"
  | "proud";

const lumiMoodLabels: Record<LumiMoodDom, string> = {
  neutral: "Lumi 小鹿吉祥物",
  happy: "开心跳起来庆祝的 Lumi 小鹿",
  encourage: "点头为你加油的 Lumi 小鹿",
  curious: "歪着头等你回答的 Lumi 小鹿",
  listening: "竖起耳朵认真听的 Lumi 小鹿",
  resting: "陪你慢慢休息的 Lumi 小鹿",
  proud: "为完成任务骄傲庆祝的 Lumi 小鹿",
};

export default function LumiMascotDom({
  size = "medium",
  mood = "neutral",
  dom: _dom,
}: {
  size?: "small" | "medium" | "large";
  mood?: LumiMoodDom;
  dom?: import("expo/dom").DOMProps;
}) {
  return (
    <div className={`lumi-scope lumi-mascot ${size} mood-${mood}`} role="img" aria-label={lumiMoodLabels[mood]}>
      <span className="lumi-ring" /><span className="lumi-pop pop-one">★</span><span className="lumi-pop pop-two">✦</span><span className="lumi-pop pop-three">●</span>
      <span className="ear left" /><span className="ear right" /><span className="antler left">Y</span><span className="antler right">Y</span><span className="eye left" /><span className="eye right" /><span className="cheek left" /><span className="cheek right" /><span className="smile" />
      <span className="lumi-arm left" /><span className="lumi-arm right" /><span className="lumi-signal">♪</span><span className="lumi-rest">z</span><span className="lumi-medal">★</span>
    </div>
  );
}
