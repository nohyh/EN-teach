/** 登录页复刻（原 LoginPage） */
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, FloatingDecorations, LumiMascot, P, PhoneShell, StatusBar } from "@/components/ui";

export default function LoginScreen({ onNext }: { onNext: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <PhoneShell mode="fit">
      <FloatingDecorations />
      <StatusBar />
      <View style={styles.brand}>
        <Text style={styles.eyebrow}>HELLO, LITTLE STAR!</Text>
        <Text style={styles.brandName}>LUMI</Text>
        <Text style={{ color: P.muted, fontSize: 13, fontWeight: "700" }}>和小鹿一起，开心学英语</Text>
        {/* 预留角/耳向上溢出的空间，避免压住上方文字 */}
        <View style={{ marginTop: 30, marginBottom: 16, alignItems: "center" }}>
          <LumiMascot size="large" />
        </View>
      </View>
      <View style={{ paddingHorizontal: 22 }}>
        <Text style={styles.helperBubble}>请家长或老师帮助小朋友登录哦</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.helperBubble}>请家长或老师帮助小朋友登录哦</Text>
        <Text style={styles.label}>学习账号</Text>
        <View style={styles.fieldWrap}>
          <View style={styles.fieldIcon}><Text style={{ color: P.violet, fontSize: 11, fontWeight: "900" }}>小</Text></View>
          <TextInput defaultValue="lumi_student" style={styles.input} autoCapitalize="none" aria-label="学习账号" />
        </View>
        <Text style={[styles.label, { marginTop: 14 }]}>登录密码</Text>
        <View style={styles.fieldWrap}>
          <View style={styles.fieldIcon}><Text style={{ color: P.violet, fontSize: 11, fontWeight: "900" }}>钥</Text></View>
          <TextInput defaultValue="123456" secureTextEntry={!showPassword} style={[styles.input, { paddingRight: 76 }]} aria-label="登录密码" />
          <Pressable onPress={() => setShowPassword((value) => !value)} style={{ position: "absolute", right: 12, top: 16 }}>
            <Text style={{ color: P.violet, fontSize: 11, fontWeight: "900" }}>{showPassword ? "藏起来" : "看一眼"}</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 16 }}><Button onPress={onNext}>出发学习 →</Button></View>
      </View>
      <Text style={styles.textButton}>忘记密码 · 请联系老师</Text>
      <Text style={styles.privacyNote}>☁ 未成年人请在家长或教师指导下使用</Text>
    </PhoneShell>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", paddingTop: 35 },
  eyebrow: { color: P.violet, fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  brandName: { color: P.violet, fontSize: 33, fontWeight: "900", letterSpacing: 3, marginTop: 4, textShadowColor: "rgba(98,87,232,.12)", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },
  form: { paddingHorizontal: 28, gap: 6, marginTop: 10 },
  helperBubble: { alignSelf: "center", marginBottom: 4, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 15, borderTopLeftRadius: 4, color: "#756bcf", backgroundColor: P.violetSoft, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  label: { color: "#4c566e", fontSize: 12, fontWeight: "900", marginTop: 8 },
  fieldWrap: { position: "relative", marginTop: 7 },
  fieldIcon: { position: "absolute", left: 12, top: 12, width: 27, height: 27, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: P.violetSoft, zIndex: 2 },
  input: { height: 52, borderWidth: 1, borderColor: "#dfe1eb", borderRadius: 15, paddingLeft: 50, paddingRight: 20, color: P.ink, fontWeight: "700", fontSize: 13, backgroundColor: "#fff" },
  textButton: { textAlign: "center", marginTop: 14, color: P.muted, fontSize: 11, fontWeight: "700" },
  privacyNote: { textAlign: "center", marginTop: 24, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#dfe2ed", paddingTop: 14, marginHorizontal: 28, color: "#9aa1b2", fontSize: 10 },
});
