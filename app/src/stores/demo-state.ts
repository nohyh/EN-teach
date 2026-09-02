import { useEffect, useState } from "react";

export type MascotSkin = "honey" | "mint" | "berry" | "midnight";

type DemoSettings = {
  sound: boolean;
  reminder: boolean;
  effects: boolean;
  slowSpeech: boolean;
};

type DemoLessonProgress = {
  completedActivities: number;
  completed: boolean;
};

export type DemoState = {
  version: 1;
  stars: number;
  checkInDays: number;
  hasCheckedIn: boolean;
  activeCourseIndex: number;
  mascotSkin: MascotSkin;
  lessonProgress: Record<string, DemoLessonProgress>;
  assignmentProgress: Record<string, number>;
  reviewedMistakes: string[];
  settings: DemoSettings;
};

const STORAGE_KEY = "lumi-demo-state-v1";

const DONE: DemoLessonProgress = {
  completedActivities: 16,
  completed: true,
};

export function lessonProgressKey(courseIndex: number, lessonIndex: number) {
  return `${courseIndex}:${lessonIndex}`;
}

function createInitialDemoState(): DemoState {
  return {
    version: 1,
    stars: 126,
    checkInDays: 12,
    hasCheckedIn: false,
    activeCourseIndex: 0,
    mascotSkin: "honey",
    lessonProgress: {
      "0:0": DONE,
      "0:1": DONE,
      "0:2": DONE,
      "0:3": { completedActivities: 3, completed: false },
      "1:0": DONE,
      "1:1": { completedActivities: 2, completed: false },
      "2:0": { completedActivities: 3, completed: false },
      "3:0": DONE,
      "3:1": DONE,
      "3:2": { completedActivities: 3, completed: false },
    },
    assignmentProgress: {
      workbook: 25,
      reading: 0,
      writing: 100,
    },
    reviewedMistakes: [],
    settings: {
      sound: true,
      reminder: true,
      effects: true,
      slowSpeech: false,
    },
  };
}

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoState>;
  return candidate.version === 1
    && typeof candidate.stars === "number"
    && typeof candidate.lessonProgress === "object"
    && typeof candidate.assignmentProgress === "object"
    && Array.isArray(candidate.reviewedMistakes)
    && typeof candidate.settings === "object";
}

function loadDemoState() {
  const initial = createInitialDemoState();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initial;
    const parsed = JSON.parse(saved) as unknown;
    if (!isDemoState(parsed)) return initial;
    return {
      ...initial,
      ...parsed,
      lessonProgress: { ...initial.lessonProgress, ...parsed.lessonProgress },
      assignmentProgress: { ...initial.assignmentProgress, ...parsed.assignmentProgress },
      settings: { ...initial.settings, ...parsed.settings },
    };
  } catch {
    return initial;
  }
}

export function useDemoState() {
  const [state, setState] = useState<DemoState>(loadDemoState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // WebView storage may be unavailable in private/restricted contexts.
    }
  }, [state]);

  const patch = (next: Partial<DemoState> | ((current: DemoState) => Partial<DemoState>)) => {
    setState((current) => ({
      ...current,
      ...(typeof next === "function" ? next(current) : next),
    }));
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore restricted storage; in-memory reset still works.
    }
    setState(createInitialDemoState());
  };

  return { state, patch, reset };
}
