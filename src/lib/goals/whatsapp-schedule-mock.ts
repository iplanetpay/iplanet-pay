import { addCalendarDays, calendarToday } from "@/lib/reservations/contribution-plan";
import type { GoalScheduleListItem, GoalScheduleRow } from "@/lib/goals/whatsapp-schedule";

type ScheduleStore = Map<string, GoalScheduleListItem>;

const SEED_USER_ID = "1";
const SEED_GOAL_ID = "mock-goal-maria";

function store(): ScheduleStore {
  const scope = globalThis as typeof globalThis & {
    __iplanetGoalWhatsappSchedule?: ScheduleStore;
  };
  if (!scope.__iplanetGoalWhatsappSchedule) {
    scope.__iplanetGoalWhatsappSchedule = seed();
  }
  return scope.__iplanetGoalWhatsappSchedule;
}

function seed(): ScheduleStore {
  const today = calendarToday();
  const created = new Date().toISOString();
  const rows: Array<Omit<GoalScheduleListItem, "id" | "goal_id" | "user_id" | "goal_name" | "created_at">> = [
    { due_date: addCalendarDays(today, -14), send_on: addCalendarDays(today, -15), kind: "day_before", status: "sent", sent_at: `${addCalendarDays(today, -15)}T13:00:00.000Z`, error: null },
    { due_date: addCalendarDays(today, -7), send_on: addCalendarDays(today, -8), kind: "day_before", status: "sent", sent_at: `${addCalendarDays(today, -8)}T13:00:00.000Z`, error: null },
    { due_date: addCalendarDays(today, -7), send_on: addCalendarDays(today, -6), kind: "late", status: "sent", sent_at: `${addCalendarDays(today, -6)}T13:00:00.000Z`, error: null },
    { due_date: today, send_on: addCalendarDays(today, -1), kind: "day_before", status: "cancelled", sent_at: null, error: "Aporte já feito." },
    { due_date: addCalendarDays(today, 7), send_on: addCalendarDays(today, 6), kind: "day_before", status: "pending", sent_at: null, error: null },
    { due_date: addCalendarDays(today, 14), send_on: addCalendarDays(today, 13), kind: "day_before", status: "pending", sent_at: null, error: null },
  ];
  return new Map(
    rows.map((row, index) => {
      const id = `mock-schedule-${index + 1}`;
      return [
        id,
        {
          ...row,
          id,
          goal_id: SEED_GOAL_ID,
          user_id: SEED_USER_ID,
          goal_name: "Meu iPhone 16",
          created_at: created,
        },
      ] as const;
    }),
  );
}

export function mockScheduleForGoal(goalId: string): GoalScheduleRow[] {
  return [...store().values()].filter((row) => row.goal_id === goalId);
}

export function mockScheduleForUser(userId: string): GoalScheduleListItem[] {
  return [...store().values()].filter((row) => row.user_id === userId);
}

export function mockInsertSchedule(rows: readonly Omit<GoalScheduleListItem, "id" | "created_at">[]) {
  const created = new Date().toISOString();
  for (const row of rows) {
    const id = globalThis.crypto.randomUUID();
    store().set(id, { ...row, id, created_at: created });
  }
}

export function mockPatchSchedule(
  ids: readonly string[],
  patch: Partial<Pick<GoalScheduleRow, "status" | "error" | "sent_at">>,
) {
  for (const id of ids) {
    const current = store().get(id);
    if (current) store().set(id, { ...current, ...patch });
  }
}
