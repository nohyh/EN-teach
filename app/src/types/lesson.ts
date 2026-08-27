/**
 * 五种教学组件契约（与 docs/lesson-components.md 一一对应）。
 * mock 数据在此基础上附带 sectionId / sectionTitle 用于分节。
 */

export interface WordComponent {
  type: "word";
  word: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  message: string;
}

export interface SentenceComponent {
  type: "sentence";
  sentence: string;
  meaning: string;
  message: string;
}

export type RecallMode = "zh_to_en" | "en_to_zh" | "audio_to_text" | "fill_blank";

export interface RecallComponent {
  type: "recall";
  mode: RecallMode;
  prompt: string;
  answer: string;
  message: string;
}

export interface PronunciationComponent {
  type: "pronunciation";
  content: string;
  meaning: string;
  message: string;
}

export interface DialogComponent {
  type: "dialog";
  scene: string;
  goal: string;
  opening: string;
}

export type LessonComponent =
  | WordComponent
  | SentenceComponent
  | RecallComponent
  | PronunciationComponent
  | DialogComponent;

type SectionTag = { sectionId?: string; sectionTitle?: string };

/** mock 数据里的活动 = 契约组件 + 分节标记 */
export type Activity = LessonComponent & SectionTag;

/** 单节课（按 sectionId 分组后） */
export interface LessonSection {
  id: string;
  title: string;
  activities: Activity[];
}
