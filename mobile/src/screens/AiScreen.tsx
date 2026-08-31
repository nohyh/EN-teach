/** AI 英语伙伴页复刻（原 AiPage），回复为固定脚本 */
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, LumiMascot, PageHeader, P, Pill, StudentPage, type StudentTab } from "@/components/ui";
import { speak } from "@/services/tts";

type Msg = { role: "lumi" | "student"; text: string; translation?: string };

const CANNED_EN = "Great choice! Let’s say it together: I like pandas!";
const CANNED_ZH = "很棒！我们一起说：我喜欢熊猫！";

export default function AiScreen({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "lumi", text: "Hi，小鹿！今天想聊动物、学校，还是听一个英语故事？", translation: "嗨，小鹿！选择一个你喜欢的话题吧。" },
  ]);
  const listRef = useRef<ScrollView>(null);

  useEffect(() => { listRef.current?.scrollToEnd({ animated: true }); }, [messages]);

  const sendMessage = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setMessages((items) => [...items, { role: "student", text: value }, { role: "lumi", text: CANNED_EN, translation: CANNED_ZH }]);
    setInput("");
  };

  return (
    <StudentPage active="ai" onNavigate={onNavigate}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flexGrow: 1 }}>
        <PageHeader eyebrow="LUMI AI BUDDY" title="AI 英语伙伴" subtitle="安全陪伴模式已开启" trailing={<Pill tone="mint">● 在线</Pill>} />
        <Card tone="violet" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <LumiMascot size="medium" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: P.violetDeep }}>Lumi 在这里</Text>
            <Text style={{ fontSize: 9, color: P.muted, lineHeight: 15 }}>可以说中文，也可以试试英语。说错没关系，我会给你小提示。</Text>
          </View>
          <Text style={{ alignSelf: "flex-start", color: P.sun, fontSize: 14 }}>✨</Text>
        </Card>
        <ScrollView ref={listRef} style={{ maxHeight: 340, marginTop: 14 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
          {messages.map((message, index) => (
            <View key={`${message.role}-${index}`} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, justifyContent: message.role === "student" ? "flex-end" : "flex-start" }}>
              {message.role === "lumi" && (
                <View style={styles.miniAi}><Text style={{ color: "#fff", fontSize: 8, fontWeight: "900" }}>AI</Text></View>
              )}
              <View style={[styles.bubble, message.role === "student" && styles.bubbleStudent]}>
                <Text style={{ fontSize: 11, fontWeight: "800", lineHeight: 17, color: message.role === "student" ? "#fff" : P.ink }}>{message.text}</Text>
                {!!message.translation && <Text style={{ fontSize: 9, color: message.role === "student" ? "rgba(255,255,255,.78)" : P.muted, marginTop: 4 }}>{message.translation}</Text>}
                {message.role === "lumi" && (
                  <Pressable onPress={() => speak(message.text)} style={{ alignSelf: "flex-start", minHeight: 25, borderRadius: 9, paddingHorizontal: 8, justifyContent: "center", backgroundColor: P.violetSoft, marginTop: 6 }}>
                    <Text style={{ color: P.violet, fontSize: 9, fontWeight: "900" }}>▶ 听一听</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 10 }}>
          {["我想聊动物", "讲个小故事", "陪我练口语"].map((text) => (
            <Pressable key={text} onPress={() => sendMessage(text)} style={styles.quickPrompt}><Text style={{ color: P.violet, fontSize: 9, fontWeight: "900" }}>{text}</Text></Pressable>
          ))}
        </ScrollView>
        <Text style={styles.safetyCaption}>Lumi 只回答适合儿童的英语学习内容，重要问题请询问老师或家长。</Text>
        <View style={styles.composer}>
          <Pressable onPress={() => setListening((value) => !value)} accessibilityLabel="语音输入"
            style={[styles.composerBtn, listening && { backgroundColor: P.coral }]}>
            <Text style={{ fontSize: 15 }}>{listening ? "◼" : "🎙"}</Text>
          </Pressable>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage(input)}
            placeholder={listening ? "正在听你说…" : "输入想问的问题"} placeholderTextColor="#9ca3b3"
            style={{ flex: 1, fontSize: 12, color: P.ink }} aria-label="向Lumi提问" />
          <Pressable onPress={() => sendMessage(input)} accessibilityLabel="发送消息" style={[styles.composerBtn, { backgroundColor: P.violet }]}>
            <Text style={{ color: "#fff", fontSize: 16 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </StudentPage>
  );
}

const styles = StyleSheet.create({
  miniAi: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: P.violet },
  bubble: { maxWidth: "82%", borderTopLeftRadius: 4, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderTopRightRadius: 15, padding: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#f0f1f6" },
  bubbleStudent: { borderTopRightRadius: 4, borderTopLeftRadius: 15, backgroundColor: P.violet, borderWidth: 0 },
  quickPrompt: { minHeight: 34, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedaff" },
  safetyCaption: { textAlign: "center", color: "#9ca3b3", fontSize: 8, lineHeight: 12, marginHorizontal: 12, marginBottom: 8 },
  composer: { flexDirection: "row", gap: 7, borderWidth: 1, borderColor: P.line, borderRadius: 19, backgroundColor: "#fff", padding: 8, alignItems: "center" },
  composerBtn: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#ffe7eb" },
});
