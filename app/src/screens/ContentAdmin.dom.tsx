"use dom";

import "./content-admin.css";
import "./content-admin-operations.css";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Asset = { id: string; original_filename: string; status: string; asset_kind: string; parse_error?: unknown; created_at: string };
type DraftSummary = { id: number; title: string; status: string; grade?: string; updated_at: string; validation_errors?: Array<{ location?: string; message?: string }> };
type Draft = DraftSummary & { description: string; theme?: string; difficulty?: string; content: Record<string, unknown>; review_note?: string };
type Course = { id: number; slug: string; title: string; status: string; current_version_id?: number };
type ManagedAssignment = { id: number; student_id: number; title: string; course_ref: string; section_id: string; total_activities: number; progress: { completed_activities: number; status: string }; feedback?: { comment: string; encouragement_tag?: string; revision: number; student_response?: string } };
type Classroom = { id: number; name: string; invite_code: string; student_count: number };
type AssignmentBatch = { id: number; title: string; due_at?: string; allow_late: boolean; status: string; revision: number; student_count: number; completed_count: number };
type ClassDashboard = { period: { days: number; from: string; to: string }; data_updated_at: string; summary: { student_count: number; learning_events: number; accuracy: number; assignment_completion_rate: number }; students: Array<{ student_id: number; name: string; learning_events: number; accuracy: number; pronunciation_average?: number; assignment_completion_rate: number; active_wrong_items: number }>; weak_knowledge_points: Array<{ knowledge_key: string; content: string; error_count: number; student_count: number }> };
type LoginResult = { access_token: string; user: { name: string; role: string } };

const statusNames: Record<string, string> = {
  uploaded: "等待解析", parsing: "解析中", parsed: "已生成草稿", parse_failed: "解析失败", ocr_pending: "等待 OCR",
  draft: "编辑中", validation_failed: "校验未通过", ready_for_review: "待审核", approved: "已通过", rejected: "已驳回", published: "已发布",
  unpublished: "已下架",
};

function displayError(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

export default function ContentAdmin({ apiBaseUrl }: { apiBaseUrl: string; dom?: import("expo/dom").DOMProps }) {
  const [token, setToken] = useState("");
  const [operator, setOperator] = useState("");
  const [operatorRole, setOperatorRole] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<ManagedAssignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [dashboard, setDashboard] = useState<ClassDashboard | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [batches, setBatches] = useState<AssignmentBatch[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [editorText, setEditorText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, { comment: string; tag: string }>>({});

  const call = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      let message = `请求失败 (${response.status})`;
      try { message = (await response.json()).detail || message; } catch { /* keep status */ }
      throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
  }, [apiBaseUrl, token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [nextAssets, nextDrafts, nextCourses, nextAssignments, nextClassrooms] = await Promise.all([
      call("/api/v1/content/assets"), call("/api/v1/content/drafts"), call("/api/v1/content/courses"), call("/api/v1/assignments"), call("/api/v1/classes"),
    ]);
    setAssets(nextAssets); setDrafts(nextDrafts); setCourses(nextCourses); setAssignments(nextAssignments); setClassrooms(nextClassrooms);
  }, [call, token]);

  useEffect(() => { void refresh().catch((error) => setNotice(displayError(error))); }, [refresh]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      if (!response.ok) throw new Error("账号或密码错误");
      const result = await response.json() as LoginResult;
      if (!(["admin", "teacher"].includes(result.user.role))) throw new Error("该账号没有内容管理权限");
      setToken(result.access_token); setOperator(`${result.user.name} · ${result.user.role}`); setOperatorRole(result.user.role);
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice("正在上传并解析…");
    try {
      await call("/api/v1/content/assets", { method: "POST", body: new FormData(event.currentTarget) });
      setNotice("上传成功，后台正在解析；稍后点刷新查看草稿");
      window.setTimeout(() => void refresh(), 900);
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const openDraft = async (id: number) => {
    try {
      const draft = await call(`/api/v1/content/drafts/${id}`) as Draft;
      setSelectedDraft(draft); setEditorText(JSON.stringify(draft.content, null, 2));
    } catch (error) { setNotice(displayError(error)); }
  };

  const saveDraft = async () => {
    if (!selectedDraft) return;
    setBusy(true);
    try {
      const content = JSON.parse(editorText);
      const updated = await call(`/api/v1/content/drafts/${selectedDraft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: selectedDraft.title, description: selectedDraft.description || "", grade: selectedDraft.grade || null, theme: selectedDraft.theme || null, difficulty: selectedDraft.difficulty || null, content }) });
      setSelectedDraft(updated); setNotice("草稿已保存"); await refresh();
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const draftAction = async (action: "validate" | "approve" | "reject" | "publish") => {
    if (!selectedDraft) return;
    setBusy(true);
    try {
      const body = action === "approve" || action === "reject" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: action === "reject" ? "内容需要修订" : "内容检查通过" }) } : {};
      await call(`/api/v1/content/drafts/${selectedDraft.id}/${action}`, { method: "POST", ...body });
      setNotice({ validate: "校验完成", approve: "审核通过", reject: "草稿已驳回", publish: "发布成功，学生端刷新后可见" }[action]);
      await refresh(); await openDraft(selectedDraft.id);
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const unpublish = async (id: number) => {
    setBusy(true);
    try { await call(`/api/v1/content/courses/${id}/unpublish`, { method: "POST" }); setNotice("课程已下架"); await refresh(); }
    catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const createAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await call("/api/v1/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        student_id: Number(form.get("student_id")), title: form.get("title"), course_ref: form.get("course_ref"),
        section_id: form.get("section_id"), total_activities: Number(form.get("total_activities")), instructions: form.get("instructions"),
      }) });
      setNotice("作业已布置，学生端刷新后可见"); await refresh(); event.currentTarget.reset();
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const createClassroom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const created = await call("/api/v1/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name") }) }) as Classroom;
      setNotice(`班级已创建，邀请码：${created.invite_code}`); await refresh(); event.currentTarget.reset();
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const saveAssignmentFeedback = async (assignment: ManagedAssignment) => {
    const draft = feedbackDrafts[assignment.id] || { comment: assignment.feedback?.comment || "", tag: assignment.feedback?.encouragement_tag || "great_progress" };
    if (draft.comment.trim().length < 2) { setNotice("评语至少需要 2 个字"); return; }
    setBusy(true);
    try {
      const updated = await call(`/api/v1/assignments/${assignment.id}/feedback`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: assignment.feedback?.revision || 0, comment: draft.comment, encouragement_tag: draft.tag }),
      }) as ManagedAssignment;
      setAssignments((items) => items.map((item) => item.id === updated.id ? updated : item));
      setFeedbackDrafts((items) => { const next = { ...items }; delete next[assignment.id]; return next; });
      setNotice("评语已发送，学生会收到站内通知");
    } catch (error) { setNotice(displayError(error)); }
    finally { setBusy(false); }
  };

  const openDashboard = async (classroomId: number) => {
    setSelectedClassId(classroomId);
    try {
      const [nextDashboard, nextBatches] = await Promise.all([call(`/api/v1/classes/${classroomId}/dashboard?days=7`), call(`/api/v1/classes/${classroomId}/assignment-batches`)]);
      setDashboard(nextDashboard as ClassDashboard); setBatches(nextBatches as AssignmentBatch[]);
    }
    catch (error) { setNotice(displayError(error)); }
  };

  const createClassAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId) { setNotice("请先选择一个班级"); return; }
    setBusy(true); const form = new FormData(event.currentTarget);
    try {
      const result = await call(`/api/v1/classes/${selectedClassId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: form.get("title"), course_ref: form.get("course_ref"), section_id: form.get("section_id"),
        total_activities: Number(form.get("total_activities")), instructions: form.get("instructions"),
        due_at: form.get("due_at") || null, allow_late: form.get("allow_late") === "on",
      }) }) as { created: number };
      setNotice(`已为班级中的 ${result.created} 名学生布置作业`); await refresh(); await openDashboard(selectedClassId);
    } catch (error) { setNotice(displayError(error)); } finally { setBusy(false); }
  };

  const toggleBatchLate = async (batch: AssignmentBatch) => {
    try {
      await call(`/api/v1/assignment-batches/${batch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: batch.revision, allow_late: !batch.allow_late }) });
      setNotice(batch.allow_late ? "已禁止该批次补交" : "已允许该批次补交");
      if (selectedClassId) await openDashboard(selectedClassId);
    } catch (error) { setNotice(displayError(error)); }
  };

  const dispatchNotifications = async () => {
    try {
      const result = await call("/api/v1/admin/notifications/dispatch", { method: "POST" }) as { created: number; skipped: number };
      setNotice(`通知派发完成：新增 ${result.created} 条，去重或跳过 ${result.skipped} 条`);
    } catch (error) { setNotice(displayError(error)); }
  };

  const exportDashboard = async () => {
    if (!selectedClassId) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/classes/${selectedClassId}/dashboard.csv?days=7`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`导出失败 (${response.status})`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `classroom-${selectedClassId}-7d.csv`; anchor.click();
      URL.revokeObjectURL(url); setNotice("班级报表已导出，操作已写入审计日志");
    } catch (error) { setNotice(displayError(error)); }
  };

  if (!token) return <main className="content-admin login"><form onSubmit={login}><a href="/">← 返回学生端</a><span>CONTENT STUDIO</span><h1>教材内容工作台</h1><p>上传教材，校验教学组件，审核后发布到学生端。</p><label>管理账号<input name="username" defaultValue="lumi_admin" required /></label><label>密码<input name="password" type="password" defaultValue="LumiAdmin123!" required /></label>{notice && <div className="notice">{notice}</div>}<button disabled={busy}>{busy ? "登录中…" : "进入工作台"}</button></form></main>;

  return <main className="content-admin">
    <header className="admin-top"><div><span>CONTENT STUDIO</span><h1>教材与教学运营工作台</h1><p>{operator}</p></div><nav>{operatorRole === "admin" && <button onClick={() => void dispatchNotifications()}>派发通知</button>}<a href="/">学生端</a><button onClick={() => { setToken(""); setOperator(""); setOperatorRole(""); }}>退出</button></nav></header>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <section className="admin-grid">
      <aside>
        <form className="admin-card upload-card" onSubmit={upload}><div className="card-title"><span>01</span><div><h2>上传教材</h2><p>JSON / Markdown / Word / PDF</p></div></div><label>教材文件<input name="file" type="file" accept=".json,.md,.markdown,.txt,.docx,.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff" required /></label><div className="two-cols"><label>年级<input name="grade" placeholder="小学一年级" /></label><label>难度<input name="difficulty" placeholder="入门" /></label></div><label>主题<input name="theme" placeholder="动物 / 校园 / 自然拼读" /></label><label>版权来源<input name="copyright_source" placeholder="自有教材 / 已获授权" required /></label><label>使用范围<select name="usage_scope" defaultValue="internal"><option value="internal">内部教学</option><option value="commercial">商业发行</option><option value="public_domain">公共领域</option></select></label><label className="check"><input name="copyright_confirmed" type="checkbox" value="true" required />我确认拥有数字化与使用权限</label><input name="asset_kind" type="hidden" value="source" /><button disabled={busy}>上传并生成草稿</button></form>
        <section className="admin-card"><div className="card-title"><span>02</span><div><h2>上传记录</h2><p>{assets.length} 个文件</p></div><button className="quiet" onClick={() => void refresh()}>刷新</button></div><div className="record-list">{assets.map((asset) => <div key={asset.id}><strong>{asset.original_filename}</strong><small>{statusNames[asset.status] || asset.status}</small>{Boolean(asset.parse_error) && <em>{JSON.stringify(asset.parse_error)}</em>}</div>)}{!assets.length && <p className="empty">还没有上传记录</p>}</div></section>
      </aside>
      <section className="workspace">
        <section className="admin-card"><div className="card-title"><span>03</span><div><h2>草稿与审核</h2><p>选择草稿后编辑结构化内容</p></div></div><div className="draft-tabs">{drafts.map((draft) => <button className={selectedDraft?.id === draft.id ? "active" : ""} key={draft.id} onClick={() => void openDraft(draft.id)}><strong>{draft.title}</strong><span>{statusNames[draft.status] || draft.status}</span></button>)}{!drafts.length && <p className="empty">上传教材后会自动生成草稿</p>}</div>{selectedDraft && <div className="draft-editor"><div className="draft-meta"><label>标题<input value={selectedDraft.title} onChange={(event) => setSelectedDraft({ ...selectedDraft, title: event.target.value })} /></label><label>说明<input value={selectedDraft.description || ""} onChange={(event) => setSelectedDraft({ ...selectedDraft, description: event.target.value })} /></label></div><textarea aria-label="课程 JSON" value={editorText} onChange={(event) => setEditorText(event.target.value)} spellCheck={false} /><div className="action-row"><button onClick={() => void saveDraft()} disabled={busy || selectedDraft.status === "published"}>保存</button><button onClick={() => void draftAction("validate")} disabled={busy || selectedDraft.status === "published"}>校验</button><button onClick={() => void draftAction("approve")} disabled={busy || selectedDraft.status !== "ready_for_review"}>通过</button><button className="danger-quiet" onClick={() => void draftAction("reject")} disabled={busy || selectedDraft.status !== "ready_for_review"}>驳回</button><button className="publish" onClick={() => void draftAction("publish")} disabled={busy || selectedDraft.status !== "approved"}>发布</button></div>{selectedDraft.validation_errors?.length ? <ul className="errors">{selectedDraft.validation_errors.map((error, index) => <li key={index}>{error.location}: {error.message}</li>)}</ul> : null}</div>}</section>
        <section className="admin-card"><div className="card-title"><span>04</span><div><h2>课程发布状态</h2><p>发布内容会出现在 Web 与手机学生端</p></div></div><div className="course-list">{courses.map((course) => <div key={course.id}><div><strong>{course.title}</strong><small>/{course.slug} · {statusNames[course.status] || course.status}</small></div>{course.status === "published" && <button onClick={() => void unpublish(course.id)} disabled={busy}>下架</button>}</div>)}{!courses.length && <p className="empty">还没有课程版本</p>}</div></section>
        <section className="admin-card"><div className="card-title"><span>05</span><div><h2>布置云端作业</h2><p>完成度由真实学习事件自动计算</p></div></div><form className="assignment-create-form" onSubmit={createAssignment}><div className="two-cols"><label>学生 ID<input name="student_id" type="number" min="1" defaultValue="2" required /></label><label>活动总数<input name="total_activities" type="number" min="1" defaultValue="16" required /></label></div><label>作业标题<input name="title" defaultValue="Hello! 第一次打招呼" required /></label><div className="two-cols"><label>课程引用<input name="course_ref" defaultValue="mock:0" required /></label><label>小节 ID<input name="section_id" defaultValue="lesson_01_greetings" required /></label></div><label>作业说明<input name="instructions" defaultValue="完成本节全部活动，进度会自动同步。" /></label><button disabled={busy}>布置作业</button></form><div className="assignment-admin-list feedback-admin-list">{assignments.map((item) => { const draft = feedbackDrafts[item.id]; return <div key={item.id}><div className="assignment-summary"><span><strong>{item.title}</strong><small>学生 {item.student_id} · {item.course_ref}/{item.section_id}</small></span><em>{item.progress.completed_activities}/{item.total_activities} · {item.progress.status}</em></div><div className="feedback-editor"><textarea aria-label={`给《${item.title}》写评语`} placeholder="写下具体、鼓励性的学习反馈" maxLength={2000} value={draft?.comment ?? item.feedback?.comment ?? ""} onChange={(event) => setFeedbackDrafts((items) => ({ ...items, [item.id]: { comment: event.currentTarget.value, tag: items[item.id]?.tag || item.feedback?.encouragement_tag || "great_progress" } }))} /><select aria-label={`选择《${item.title}》评语标签`} value={draft?.tag ?? item.feedback?.encouragement_tag ?? "great_progress"} onChange={(event) => setFeedbackDrafts((items) => ({ ...items, [item.id]: { comment: items[item.id]?.comment ?? item.feedback?.comment ?? "", tag: event.currentTarget.value } }))}><option value="great_progress">进步很大</option><option value="keep_practicing">继续练习</option><option value="careful_work">认真细致</option><option value="confident_speaking">大胆开口</option></select><button type="button" disabled={busy} onClick={() => void saveAssignmentFeedback(item)}>{item.feedback ? "更新评语" : "发送评语"}</button></div>{item.feedback?.student_response && <p className="student-feedback-response">学生回复：{item.feedback.student_response}</p>}</div>; })}</div></section>
        <section className="admin-card">
          <div className="card-title"><span>06</span><div><h2>班级运营</h2><p>邀请码入班、批量作业与学习看板</p></div></div>
          <form className="inline-create" onSubmit={createClassroom}><input name="name" placeholder="例如：一年级星星班" required /><button disabled={busy}>创建班级</button></form>
          <div className="classroom-list">{classrooms.map((item) => <button type="button" className={selectedClassId === item.id ? "active" : ""} key={item.id} onClick={() => void openDashboard(item.id)}><span><strong>{item.name}</strong><small>邀请码 {item.invite_code}</small></span><em>{item.student_count} 人</em></button>)}{!classrooms.length && <p className="empty">还没有班级</p>}</div>
          {selectedClassId && <form className="assignment-create-form class-assignment" onSubmit={createClassAssignment}><h3>给当前班级布置作业</h3><div className="two-cols"><label>标题<input name="title" defaultValue="本周英语练习" required /></label><label>活动总数<input name="total_activities" type="number" min="1" defaultValue="16" required /></label></div><div className="two-cols"><label>课程引用<input name="course_ref" defaultValue="mock:0" required /></label><label>小节 ID<input name="section_id" defaultValue="lesson_01_greetings" required /></label></div><div className="two-cols"><label>截止时间<input name="due_at" type="datetime-local" /></label><label className="check"><input name="allow_late" type="checkbox" defaultChecked />允许补交</label></div><label>说明<input name="instructions" defaultValue="按顺序完成全部活动。" /></label><button disabled={busy}>创建作业批次</button></form>}
          {batches.length > 0 && <div className="batch-list"><h3>作业批次</h3>{batches.map((batch) => <div key={batch.id}><span><strong>{batch.title}</strong><small>版本 {batch.revision} · {batch.completed_count}/{batch.student_count} 已完成 · {batch.allow_late ? "允许补交" : "禁止补交"}</small></span><button type="button" onClick={() => void toggleBatchLate(batch)}>{batch.allow_late ? "禁止补交" : "允许补交"}</button></div>)}</div>}
        </section>
        {dashboard && <section className="admin-card"><div className="card-title"><span>07</span><div><h2>近 7 天学习看板</h2><p>更新时间 {new Date(dashboard.data_updated_at).toLocaleString()}</p></div><button className="export-link" type="button" onClick={() => void exportDashboard()}>导出 CSV</button></div><div className="metric-grid"><div><strong>{dashboard.summary.student_count}</strong><small>学生</small></div><div><strong>{dashboard.summary.learning_events}</strong><small>学习活动</small></div><div><strong>{dashboard.summary.accuracy}%</strong><small>正确率</small></div><div><strong>{dashboard.summary.assignment_completion_rate}%</strong><small>作业完成率</small></div></div><div className="student-metrics">{dashboard.students.map((student) => <div key={student.student_id}><span><strong>{student.name}</strong><small>{student.learning_events} 次学习 · {student.active_wrong_items} 个待复习</small></span><em>正确率 {student.accuracy}%</em></div>)}</div>{dashboard.weak_knowledge_points.length > 0 && <div className="weak-points"><h3>薄弱知识点</h3>{dashboard.weak_knowledge_points.map((item) => <span key={item.knowledge_key}>{item.content} · 错误 {item.error_count} 次</span>)}</div>}</section>}
      </section>
    </section>
  </main>;
}
