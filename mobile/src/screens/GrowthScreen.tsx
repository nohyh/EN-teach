/** 我的成长复刻（原 GrowthPage） */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, LumiMascot, PageHeader, P, Pill, ProgressBar, SectionTitle, StudentPage, type StudentTab, type Tone } from "@/components/ui";

export default function GrowthScreen({ onNavigate, onLogout }: { onNavigate: (tab: StudentTab) => void; onLogout: () => void }) {
  const skills: Array<{ name: string; value: number; tone: Tone }> = [
    { name: "词汇", value: 78, tone: "violet" },
    { name: "口语", value: 64, tone: "mint" },
    { name: "阅读", value: 72, tone: "sky" },
    { name: "写作", value: 55, tone: "pink" },
  ];
  return (
    <StudentPage active="growth" onNavigate={onNavigate}>
      <PageHeader
        eyebrow="MY GROWTH" title="我的成长" subtitle="每一点进步都值得被看见"
        trailing={<Pressable accessibilityLabel="设置" style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: P.violetSoft, alignItems: "center", justifyContent: "center" }}><Text>⚙</Text></Pressable>}
      />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <View style={styles.avatar}><LumiMascot size="small" /></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: "900", color: P.ink }}>陈小鹿</Text>
          <Text style={{ fontSize: 8, color: P.muted }}>阳光小学 · 三年级2班</Text>
          <Pill tone="yellow">Level 6 · 小小探险家</Pill>
        </View>
      </Card>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 11 }}>
        {[{ s: "本周学习", v: "4", u: "天", d: "按自己的节奏前进" }, { s: "本周星星", v: "48", u: "颗", d: "每颗都记录一次努力" }].map((stat) => (
          <Card key={stat.s} style={{ flex: 1, minHeight: 105, justifyContent: "center", gap: 4 }}>
            <Text style={{ color: P.muted, fontSize: 8 }}>{stat.s}</Text>
            <Text style={{ color: P.violetDeep, fontSize: 25, fontWeight: "900" }}>{stat.v}<Text style={{ fontSize: 9, color: P.muted }}> {stat.u}</Text></Text>
            <Text style={{ color: "#a0a6b5", fontSize: 7 }}>{stat.d}</Text>
          </Card>
        ))}
      </View>
      <SectionTitle eyebrow="SKILLS" title="能力成长" action="学习周报 →" />
      <Card style={{ gap: 15, paddingVertical: 17 }}>
        {skills.map((skill) => (
          <View key={skill.name} style={styles.skillRow}>
            <Text style={{ fontSize: 9, color: P.ink, width: 34 }}>{skill.name}</Text>
            <View style={{ flex: 1 }}><ProgressBar value={skill.value} tone={skill.tone} /></View>
            <Text style={{ fontSize: 11, fontWeight: "900", color: P.violetDeep, width: 34, textAlign: "right" }}>{skill.value}%</Text>
          </View>
        ))}
      </Card>
      <SectionTitle eyebrow="MY PLAN" title="我的专属学习计划" />
      <Card tone="violet">
        <View style={styles.planTop}>
          <View style={{ gap: 7 }}>
            <Pill tone="violet">本周计划</Pill>
            <Text style={{ fontSize: 13, fontWeight: "900", color: P.ink }}>已完成 4 / 7 个任务</Text>
          </View>
          <Text style={{ color: P.violet, fontSize: 20, fontWeight: "900" }}>57%</Text>
        </View>
        <ProgressBar value={57} tone="violet" />
        <Text style={{ color: P.muted, fontSize: 8, lineHeight: 13, marginVertical: 11 }}>今天建议：复习 12 个动物单词，再练习 8 分钟口语。</Text>
        <Button onPress={() => onNavigate("learn")} style={{ minHeight: 42 }}>开始今日计划</Button>
      </Card>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 13 }}>
        <Text style={{ fontSize: 26 }}>📘</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: "900", color: P.ink }}>我的错题本</Text>
          <Text style={{ fontSize: 8, color: P.muted, marginTop: 3 }}>共 18 题，今天建议复习 5 题</Text>
        </View>
        <Pressable><Text style={{ color: P.violet, fontSize: 9, fontWeight: "900" }}>开始复习 ›</Text></Pressable>
      </Card>
      <Pressable onPress={onLogout}><Text style={{ textAlign: "center", minHeight: 38, marginTop: 13, color: "#9ca3b3", fontSize: 9, lineHeight: 38 }}>退出演示账号</Text></Pressable>
    </StudentPage>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: P.violetSoft, alignItems: "center", justifyContent: "center" },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  planTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 11 },
});
