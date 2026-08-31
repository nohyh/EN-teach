/** 身份选择页复刻（原 RolePage） */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, FloatingDecorations, LumiMascot, P, PhoneShell, Pill, StatusBar } from "@/components/ui";

export default function RoleScreen({ onEnter, onBack }: { onEnter: () => void; onBack: () => void }) {
  return (
    <PhoneShell mode="fit">
      <FloatingDecorations />
      <StatusBar />
      <LinearGradient colors={["#eeecff", "#e5f6ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>WHO ARE YOU?</Text>
          <Text style={{ fontSize: 27, fontWeight: "900", color: P.ink, marginTop: 5 }}>你是谁呀？</Text>
          <Text style={{ color: P.muted, fontSize: 11, lineHeight: 17, marginTop: 7 }}>选择身份，Lumi 带你去对应的小天地</Text>
        </View>
        <LumiMascot size="small" />
      </LinearGradient>
      <View style={styles.list}>
        <Pressable onPress={onEnter} style={[styles.roleCard, styles.studentCard]}>
          <View style={[styles.iconBox, { backgroundColor: "#e9e6ff" }]}><Text style={{ color: P.violet, fontWeight: "1000" as unknown as "900", fontSize: 15 }}>学</Text></View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: P.ink }}>我是小学生</Text>
            <Text style={{ fontSize: 10, color: P.muted }}>课程、AI伙伴、作业与成长</Text>
          </View>
          <Pill tone="violet">进入 →</Pill>
        </Pressable>
        {[
          { icon: "师", bg: "#dcf3ff", fg: "#308fc6", title: "我是老师", desc: "教师端本期暂不制作" },
          { icon: "家", bg: "#ffe4e8", fg: "#e36b7e", title: "我是家长", desc: "家长端本期暂不制作" },
        ].map((role) => (
          <View key={role.title} style={[styles.roleCard, styles.disabledCard]}>
            <View style={[styles.iconBox, { backgroundColor: role.bg }]}><Text style={{ color: role.fg, fontWeight: "900", fontSize: 15 }}>{role.icon}</Text></View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: "#9aa1b2" }}>{role.title}</Text>
              <Text style={{ fontSize: 10, color: P.muted }}>{role.desc}</Text>
            </View>
            <Pill tone="gray">暂未开放</Pill>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button onPress={onEnter}>以学生身份进入</Button>
        <Button variant="secondary" onPress={onBack}>返回登录</Button>
      </View>
    </PhoneShell>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 146, marginHorizontal: 20, marginVertical: 16, borderRadius: 24, padding: 22, gap: 10 },
  eyebrow: { color: P.violet, fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  list: { gap: 13, paddingHorizontal: 20 },
  roleCard: { width: "100%", minHeight: 104, flexDirection: "row", alignItems: "center", gap: 13, borderWidth: 1, borderColor: "#e8eaf3", borderRadius: 20, padding: 14, backgroundColor: "#fff" },
  studentCard: { borderWidth: 2, borderColor: "#847af5", backgroundColor: "#fff" },
  disabledCard: { opacity: 0.67 },
  iconBox: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-3deg" }] },
  actions: { gap: 10, marginHorizontal: 20, marginTop: 40 },
});
