export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatReply = {
  english: string;
  translation: string;
};

export type DialogCheckRequest = {
  scene: string;
  goal: string;
  opening: string;
  utterance: string;
};

export type DialogCheckResult = {
  correct: boolean;
  feedback: string;
  translation: string;
  hint: string;
};

export type PhonemeScore = {
  char: string;
  score: number;
};

export type WordScore = {
  text: string;
  score: number;
  phonemes: PhonemeScore[];
};

export type EvaluationResult = {
  overall: number;
  accuracy: number;
  fluency: number;
  integrity: number;
  passed: boolean;
  threshold: number;
  words: WordScore[];
  mode: "aliyun" | "mock";
};

/** 可跨 Expo DOM bridge 传递的、完全 JSON 可序列化的能力。 */
export type SpeechRuntime = {
  startRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<string>;
  stopAndEvaluate: (referenceText: string) => Promise<EvaluationResult>;
  chatWithLumi: (messages: ChatMessage[]) => Promise<ChatReply>;
  checkDialog: (request: DialogCheckRequest) => Promise<DialogCheckResult>;
  speakText: (text: string, options?: { rate?: number }) => Promise<void>;
};
