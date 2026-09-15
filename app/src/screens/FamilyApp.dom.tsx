"use dom";

import "./family-app.css";
import "./family-notifications.css";

import { FormEvent, useCallback, useState } from "react";

type Child = { id: number; name: string; username: string };
type Preferences = { weekly_report: boolean; assignment_due: boolean; review_due: boolean; streak_reminder: boolean };
type WeeklyReport = { student: Child; period: { from: string; to: string }; data_updated_at: string; due_reviews: number; summary: { learning_events: number; accuracy: number; pronunciation_average?: number; completed_assignments: number; active_wrong_items: number; mastered_wrong_items: number }; recent_courses: Array<{ course_ref: string; section_id: string; status: string; completed_activities: number; total_activities: number }> };
type FamilyNotification = { id: number; type: string; title: string; body: string; delivered_at: string; read_at?: string };
type LearningPolicy = {
  settings: { is_configured: boolean; learning_enabled: boolean; daily_limit_minutes: number; allowed_start: string; allowed_end: string; timezone: string; voice_enabled: boolean; ai_enabled: boolean; updated_at?: string };
  usage: { date: string; active_seconds: number; used_minutes: number; remaining_minutes: number };
  access: { allowed: boolean; reason?: string; message?: string };
};

const preferenceLabels: Record<keyof Preferences, string> = {
  weekly_report: "每周学习报告", assignment_due: "作业临期提醒", review_due: "错题复习到期", streak_reminder: "连续学习提醒",
};

export default function FamilyApp({ apiBaseUrl }: { apiBaseUrl: string; dom?: import("expo/dom").DOMProps }) {
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [policy, setPolicy] = useState<LearningPolicy | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const call = useCallback(async <T,>(path: string, accessToken: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers); headers.set("Authorization", `Bearer ${accessToken}`);
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
    if (!response.ok) { let message = `请求失败 (${response.status})`; try { message = (await response.json()).detail || message; } catch { /* keep status */ } throw new Error(message); }
    return await response.json() as T;
  }, [apiBaseUrl]);

  const loadReport = async (childId: number, accessToken = token) => {
    setSelectedChild(childId);
    const [nextReport, nextPolicy] = await Promise.all([
      call<WeeklyReport>(`/api/v1/parent/weekly-report?student_id=${childId}`, accessToken),
      call<LearningPolicy>(`/api/v1/parent/children/${childId}/learning-policy`, accessToken),
    ]);
    setReport(nextReport); setPolicy(nextPolicy);
  };

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice(""); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      if (!response.ok) throw new Error("账号或密码错误");
      const session = await response.json() as { access_token: string; user: { name: string; role: string } };
      if (session.user.role !== "parent") throw new Error("该账号不是家长账号");
      const [nextChildren, nextPreferences, nextNotifications] = await Promise.all([
        call<Child[]>("/api/v1/parent/children", session.access_token), call<Preferences>("/api/v1/me/notification-preferences", session.access_token), call<FamilyNotification[]>("/api/v1/me/notifications", session.access_token),
      ]);
      setToken(session.access_token); setParentName(session.user.name); setChildren(nextChildren); setPreferences(nextPreferences); setNotifications(nextNotifications);
      if (nextChildren[0]) await loadReport(nextChildren[0].id, session.access_token);
    } catch (error) { setNotice(error instanceof Error ? error.message : "登录失败"); } finally { setBusy(false); }
  };

  const updatePreference = async (key: keyof Preferences) => {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    try {
      setPreferences(await call<Preferences>("/api/v1/me/notification-preferences", token, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }));
      setNotice("通知偏好已保存");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); }
  };

  const markRead = async (notificationId: number) => {
    try {
      const updated = await call<FamilyNotification>(`/api/v1/me/notifications/${notificationId}/read`, token, { method: "POST" });
      setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (error) { setNotice(error instanceof Error ? error.message : "通知更新失败"); }
  };

  const savePolicy = async () => {
    if (!policy || !selectedChild) return;
    setBusy(true); setNotice("");
    try {
      const updated = await call<LearningPolicy>(`/api/v1/parent/children/${selectedChild}/learning-policy`, token, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policy.settings),
      });
      setPolicy(updated); setNotice("学习规则已保存，并会在学生端立即生效");
    } catch (error) { setNotice(error instanceof Error ? error.message : "学习规则保存失败"); }
    finally { setBusy(false); }
  };

  const patchPolicy = <K extends keyof LearningPolicy["settings"]>(key: K, value: LearningPolicy["settings"][K]) => {
    setPolicy((current) => current ? { ...current, settings: { ...current.settings, [key]: value } } : current);
  };

  const refreshFamily = async () => {
    try {
      const nextNotifications = await call<FamilyNotification[]>("/api/v1/me/notifications", token);
      setNotifications(nextNotifications);
      if (selectedChild) await loadReport(selectedChild);
      setNotice("周报和通知已刷新");
    } catch (error) { setNotice(error instanceof Error ? error.message : "刷新失败"); }
  };

  if (!token) return <main className="family-app family-login"><form onSubmit={login}><a href="/">← 返回</a><span>FAMILY VIEW</span><h1>家长学习周报</h1><p>只展示已绑定孩子的学习情况，不制造排名焦虑。</p><label>家长账号<input name="username" defaultValue="lumi_parent" required /></label><label>密码<input name="password" type="password" defaultValue="LumiDemo123!" required /></label>{notice && <div className="family-notice">{notice}</div>}<button disabled={busy}>{busy ? "登录中…" : "查看周报"}</button></form></main>;

  return <main className="family-app">
    <header><div><span>FAMILY VIEW</span><h1>{parentName}，这是本周学习小结</h1><p>统计截至 {report ? new Date(report.data_updated_at).toLocaleString() : "加载中"}</p></div><nav><button onClick={() => void refreshFamily()}>刷新</button><a href="/">学生端</a><button onClick={() => setToken("")}>退出</button></nav></header>
    {notice && <div className="family-notice">{notice}</div>}
    <div className="family-layout">
      <section className="family-panel"><h2>我的孩子</h2>{children.map((child) => <button className={selectedChild === child.id ? "active" : ""} key={child.id} onClick={() => void loadReport(child.id)}><strong>{child.name}</strong><small>@{child.username}</small></button>)}{!children.length && <p>尚未绑定孩子，请联系老师或管理员。</p>}</section>
      <section className="family-report">
        {report && <><div className="family-metrics"><article><strong>{report.summary.learning_events}</strong><small>学习活动</small></article><article><strong>{report.summary.accuracy}%</strong><small>正确率</small></article><article><strong>{report.summary.completed_assignments}</strong><small>完成作业</small></article><article><strong>{report.due_reviews}</strong><small>待复习</small></article></div><section className="family-card"><h2>进步与需要协助</h2><p>已稳定掌握 <b>{report.summary.mastered_wrong_items}</b> 个知识点，目前还有 <b>{report.summary.active_wrong_items}</b> 个知识点需要继续复习。</p>{report.summary.pronunciation_average != null && <p>本周发音平均分 <b>{report.summary.pronunciation_average}</b>。</p>}</section><section className="family-card"><h2>最近课程</h2>{report.recent_courses.map((course, index) => <div className="course-progress" key={`${course.course_ref}-${course.section_id}-${index}`}><span><strong>{course.section_id}</strong><small>{course.course_ref}</small></span><em>{course.completed_activities}/{course.total_activities}</em></div>)}{!report.recent_courses.length && <p>本周还没有课程学习记录。</p>}</section></>}
        {policy && <section className="family-card learning-policy-card"><div className="policy-title"><div><h2>学习规则</h2><p>今天已学习 {policy.usage.used_minutes} 分钟，还可学习 {policy.usage.remaining_minutes} 分钟。</p></div><span className={policy.access.allowed ? "policy-open" : "policy-blocked"}>{!policy.settings.is_configured ? "保存后启用规则" : policy.access.allowed ? "当前可学习" : policy.access.message}</span></div><div className="policy-grid"><label>每日上限（分钟）<input type="number" min="5" max="240" value={policy.settings.daily_limit_minutes} onChange={(event) => patchPolicy("daily_limit_minutes", Number(event.currentTarget.value))} /></label><label>开始时间<input type="time" value={policy.settings.allowed_start} onChange={(event) => patchPolicy("allowed_start", event.currentTarget.value)} /></label><label>结束时间<input type="time" value={policy.settings.allowed_end} onChange={(event) => patchPolicy("allowed_end", event.currentTarget.value)} /></label><label>时区<select value={policy.settings.timezone} onChange={(event) => patchPolicy("timezone", event.currentTarget.value)}><option value="Asia/Shanghai">中国标准时间</option><option value="Asia/Hong_Kong">香港时间</option><option value="Asia/Taipei">台北时间</option></select></label></div><div className="policy-toggles"><label><input type="checkbox" checked={policy.settings.learning_enabled} onChange={(event) => patchPolicy("learning_enabled", event.currentTarget.checked)} />允许学习</label><label><input type="checkbox" checked={policy.settings.voice_enabled} onChange={(event) => patchPolicy("voice_enabled", event.currentTarget.checked)} />允许语音</label><label><input type="checkbox" checked={policy.settings.ai_enabled} onChange={(event) => patchPolicy("ai_enabled", event.currentTarget.checked)} />允许 AI 对话</label></div><button onClick={() => void savePolicy()} disabled={busy}>{busy ? "保存中…" : "保存学习规则"}</button></section>}
        <section className="family-card"><h2>站内通知</h2>{notifications.map((item) => <button className={`notification-row ${item.read_at ? "read" : "unread"}`} key={item.id} onClick={() => void markRead(item.id)}><span><strong>{item.title}</strong><small>{item.body}</small></span><em>{item.read_at ? "已读" : "标为已读"}</em></button>)}{!notifications.length && <p>目前没有新通知。</p>}</section>
        <section className="family-card"><h2>通知偏好</h2><p>默认关闭连续签到提醒，减少不必要的学习焦虑。</p>{preferences && (Object.keys(preferenceLabels) as Array<keyof Preferences>).map((key) => <label className="preference-row" key={key}><span>{preferenceLabels[key]}</span><input type="checkbox" checked={preferences[key]} onChange={() => void updatePreference(key)} /></label>)}</section>
      </section>
    </div>
  </main>;
}
