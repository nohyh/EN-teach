/**
 * TTS 封装：先接 expo-speech 本地引擎（decisions.md D6），云端方案后置。
 * playLumiSound 暂为无声占位（原 H5 用 WebAudio 提示音），后续用 expo-av 补。
 */
import * as Speech from "expo-speech";

export function speak(text: string, onState?: (playing: boolean) => void) {
  stopSpeech();
  Speech.speak(text, {
    language: "en-US",
    rate: 0.82,
    onStart: () => onState?.(true),
    onDone: () => onState?.(false),
    onError: () => onState?.(false),
  });
}

export function stopSpeech() {
  Speech.stop();
}

export type LumiSoundKind = "correct" | "retry" | "help" | "complete";

export function playLumiSound(_kind: LumiSoundKind) {
  // TODO(P2): 用 expo-av 补一段短提示音；原型里的 WebAudio 和弦此处暂不还原
}
