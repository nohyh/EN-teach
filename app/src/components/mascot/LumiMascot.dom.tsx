"use dom";

import "../../reference/student-ui.css";
import { LumiMascot as BearMascot, type LumiMood, type LumiVariant } from "../../reference/student-ui";

export type LumiMoodDom = LumiMood;

export default function LumiMascotDom({
  size = "medium",
  mood = "neutral",
  variant = "head",
  dom: _dom,
}: {
  size?: "small" | "medium" | "large";
  mood?: LumiMoodDom;
  variant?: LumiVariant;
  dom?: import("expo/dom").DOMProps;
}) {
  return <BearMascot size={size} mood={mood} variant={variant} />;
}
