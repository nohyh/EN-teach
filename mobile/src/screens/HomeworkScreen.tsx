/** 作业中心复刻（原 HomeworkPage） */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, LumiMascot, PageHeader, P, Pill, StudentPage, type StudentTab, type Tone } from "@/components/ui";

const HOMEWORK_ITEMS = [
  { title: "Unit 3 书面作业", detail: "拍照上传练习册第 12 页", status: "待完成", tone: "yellow" as Tone, icon: "拍", action: "去完成" },
  { title: "At the zoo 口语", detail: "朗读 3 句话，预计 5 分钟", status: "待完成", tone: "pink" as Tone, icon: "说", action: "去录音" },
  { title: "My family 小作文", detail: "AI 正在识别和批改", status: "批改中", tone: "sky" as Tone, icon: "文", action: "查看进度" },
  { title: "单词听写 · 动物", detail: "得分 92，订正 1 题", status: "已完成", tone: "mint" as Tone, icon: "✓", action: "看结果" },
];

export default function HomeworkScreen({ onNavigate }: { onNavigate: (tab: StudentTab) => void }) {
  const [filter, setFilter] = useState("待完成");
  const visible = HOMEWORK_ITEMS.filter((item) => item.status === filter);
  return (
    <StudentPage active="homework" onNavigate={onNavigate}>
      <PageHeader eyebrow="HOMEWORK" title="作业中心" subtitle="先完成一点，再开心玩耍" trailing={<Pill tone="pink">2项待完成</Pill>} />
      <Card style={{ flexDirection: "row", alignItems: "center", minHeight: 112 }}>
        <View style={[styles.summaryCol, { borderRightWidth: 1, borderRightColor: "rgba(232,234,243,.9)" }]}>
          <Text style={styles.summaryLabel}>今日作业</Text>
          <Text style={styles.summaryStrong}>2</Text>
          <Text style={styles.summarySmall}>项待完成</Text>
        </View>
        <View style={[styles.summaryCol, { marginLeft: 12 }]}>
          <Text style={styles.summaryLabel}>本周正确率</Text>
          <Text style={styles.summaryStrong}>89%</Text>
          <Text style={styles.summarySmall}>比上周 +6%</Text>
        </View>
        <View style={{ marginLeft: "auto" }}><LumiMascot size="small" /></View>
      </Card>
      <View style={styles.tabs}>
        {["待完成", "批改中", "已完成"].map((tab) => (
          <Pressable key={tab} onPress={() => setFilter(tab)} style={[styles.tab, filter === tab && styles.tabActive]} accessibilityState={{ selected: filter === tab }}>
            <Text style={{ color: filter === tab ? P.violet : "#858d9e", fontSize: 9, fontWeight: "900" }}>{tab}</Text>
            <View style={styles.tabCount}><Text style={{ fontSize: 7, color: P.muted }}>{HOMEWORK_ITEMS.filter((item) => item.status === tab).length}</Text></View>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 11 }}>
        {visible.map((item) => (
          <Card key={item.title} style={{ flexDirection: "row", alignItems: "center", gap: 11, minHeight: 108 }}>
            <View style={[styles.hwIcon, { backgroundColor: { yellow: "#fff2c7", pink: "#ffe5e9", sky: "#def3ff", mint: "#dff8f3", violet: P.violetSoft, gray: "#eff1f5" }[item.tone] }]}>
              <Text style={{ fontWeight: "900", fontSize: 15, color: { yellow: "#92680c", pink: "#d95f73", sky: "#207da9", mint: "#128373", violet: P.violet, gray: P.muted }[item.tone] }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Pill tone={item.tone}>{item.status}</Pill>
              <Text style={{ fontSize: 12, fontWeight: "900", color: P.ink, marginTop: 2 }}>{item.title}</Text>
              <Text style={{ fontSize: 8, color: P.muted, lineHeight: 12 }}>{item.detail}</Text>
            </View>
            <Button variant={item.status === "待完成" ? "primary" : "secondary"} style={{ minHeight: 36, paddingHorizontal: 12 }}>{item.action}</Button>
          </Card>
        ))}
      </View>
      {filter === "待完成" && (
        <Card tone="sky" style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Text style={{ fontSize: 24 }}>📷</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: "900", color: P.ink }}>拍照小技巧</Text>
            <Text style={{ fontSize: 8, color: P.muted, lineHeight: 12, marginTop: 4 }}>把作业纸放平、光线亮一点，四个角都拍进去。</Text>
          </View>
        </Card>
      )}
    </StudentPage>
  );
}

const styles = StyleSheet.create({
  summaryCol: { gap: 2, paddingRight: 12 },
  summaryLabel: { color: P.muted, fontSize: 8, letterSpacing: 1 },
  summaryStrong: { color: P.violetDeep, fontSize: 22, fontWeight: "900" },
  summarySmall: { color: P.muted, fontSize: 7 },
  tabs: { flexDirection: "row", gap: 5, backgroundColor: "#eaecef", borderRadius: 15, padding: 5, marginVertical: 15 },
  tab: { flex: 1, minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 11 },
  tabActive: { backgroundColor: "#fff", shadowColor: "#2b3151", shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabCount: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#eef0f4", alignItems: "center", justifyContent: "center" },
  hwIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
