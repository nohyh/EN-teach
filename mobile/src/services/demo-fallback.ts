import type { ChatMessage, ChatReply, EvaluationResult, WordScore } from "@/types/speech";

function scoreSeed(text: string, audioBytes: number) {
  const textSeed = [...text].reduce((total, char) => total + char.charCodeAt(0), 0);
  return textSeed + Math.min(audioBytes, 32_000);
}

/**
 * 演示现场断网或后端未启动时使用的确定性评分。
 * 明确返回 mock 模式，UI 会展示“本地演示评分”，不会伪装成云端结果。
 */
export function createDemoEvaluation(pcm: ArrayBuffer, referenceText: string): EvaluationResult {
  const seed = scoreSeed(referenceText, pcm.byteLength);
  const overall = 84 + (seed % 10);
  const words = referenceText.trim().split(/\s+/).filter(Boolean).map<WordScore>((text, index) => {
    const score = Math.max(76, Math.min(98, overall + ((index * 3 + seed) % 9) - 4));
    return {
      text,
      score,
      phonemes: [...text.replace(/[^a-z]/gi, "").slice(0, 6)].map((char, phonemeIndex) => ({
        char: char.toLowerCase(),
        score: Math.max(72, Math.min(99, score + ((phonemeIndex + seed) % 7) - 3)),
      })),
    };
  });

  return {
    overall,
    accuracy: Math.max(78, overall - 2),
    fluency: Math.min(98, overall + 3),
    integrity: Math.min(99, overall + 5),
    passed: true,
    threshold: 70,
    words,
    mode: "mock",
  };
}

const topicReplies: Array<{ keywords: string[]; reply: ChatReply }> = [
  { keywords: ["动物", "animal", "panda", "熊猫"], reply: { english: "I love animals! My favorite animal is the panda. What animal do you like?", translation: "我喜欢动物！我最喜欢熊猫。你喜欢什么动物？（本地演示回复）" } },
  { keywords: ["故事", "story"], reply: { english: "Once there was a little bear who found a shining star. Shall we finish the story together?", translation: "从前有一只小熊发现了一颗闪亮的星星。我们一起续写故事好吗？（本地演示回复）" } },
  { keywords: ["口语", "speak", "speaking"], reply: { english: "Let’s practice: My name is Xiaolu, and I like English!", translation: "我们来练习：我叫小鹿，我喜欢英语！（本地演示回复）" } },
  { keywords: ["学校", "school"], reply: { english: "School is fun! I have a book and a blue pencil in my schoolbag.", translation: "学校很有趣！我的书包里有一本书和一支蓝色铅笔。（本地演示回复）" } },
  { keywords: ["家庭", "家人", "family"], reply: { english: "This is my family. We like reading together at home.", translation: "这是我的家人。我们喜欢在家一起阅读。（本地演示回复）" } },
  { keywords: ["食物", "水果", "food", "fruit"], reply: { english: "Yummy! I like apples and bananas. What fruit do you like?", translation: "真好吃！我喜欢苹果和香蕉。你喜欢什么水果？（本地演示回复）" } },
];

export function createDemoChatReply(messages: ChatMessage[]): ChatReply {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content.toLowerCase() ?? "";
  return topicReplies.find(({ keywords }) => keywords.some((keyword) => latest.includes(keyword.toLowerCase())))?.reply ?? {
    english: "That sounds interesting! Can you tell me one more thing in English?",
    translation: "听起来很有趣！你能再用英语告诉我一件事吗？（本地演示回复）",
  };
}
