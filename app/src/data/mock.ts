/**
 * 嘟噜噜假课程加载：把扁平的 parser_ready JSON 按 sectionId 分组成 10 节课。
 * 数据结构见 app/assets/mock/dudulu_fake_course_10_lessons_bundle/。
 */
import rawJson from "../../assets/mock/dudulu_fake_course_10_lessons_bundle/dudulu_fake_course_flat_parser_ready.json";
import type { Activity, LessonSection } from "@/types/lesson";

interface FlatCourse {
  id: string;
  title: string;
  intro: string;
  activities: Activity[];
}

const flat = rawJson as unknown as FlatCourse;

function groupBySection(activities: Activity[]): LessonSection[] {
  const sections: LessonSection[] = [];
  const indexById = new Map<string, number>();
  for (const activity of activities) {
    const id = activity.sectionId ?? "default_section";
    let index = indexById.get(id);
    if (index == null) {
      index = sections.length;
      indexById.set(id, index);
      sections.push({ id, title: activity.sectionTitle ?? "未命名小节", activities: [] });
    }
    sections[index].activities.push(activity);
  }
  return sections;
}

export const LESSONS: LessonSection[] = groupBySection(flat.activities);
