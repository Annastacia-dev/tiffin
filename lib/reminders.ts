// Works out when prep and cook reminders are due. No server or browser dependencies:
// the cron route uses it to send reminders, and the planner uses it to show the same times.
//
// A "wall" time is a local clock time stored as if it were UTC, so day and minute
// arithmetic stays simple. wallToInstant() turns one into a real moment in the user's time zone.

const MINUTE = 60_000;
const DAY_MINUTES = 1440;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Quiet-hours reminders move to this long before quiet hours start, e.g. a 22:00 start sends at 21:30. */
const QUIET_BUFFER_MINUTES = 30;

export type PrepStep = { task: string; hoursBefore: number };
type RecipeLike = { id: string; title: string; prep?: PrepStep[] | null };
export type ReminderSettings = {
  meals: string[];
  mealTimes: Record<string, string>;
  reminders: { prep: boolean; cook: boolean };
  quietStart: string;
  quietEnd: string;
  timezone: string;
};
export type Reminder = { key: string; at: Date; title: string; body: string };

function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toWall(date: string, time: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return Date.UTC(y, mo - 1, d) + minutesOf(time) * MINUTE;
}

function offsetAt(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(instant / 1000) * 1000;
}

export function wallToInstant(wall: number, timeZone: string) {
  const guess = wall - offsetAt(wall, timeZone);
  return new Date(wall - offsetAt(guess, timeZone));
}

/** Moves a time inside quiet hours to just before they started, so there's still enough time for the prep. */
export function avoidQuietHours(wall: number, quietStart: string, quietEnd: string) {
  const start = minutesOf(quietStart);
  const end = minutesOf(quietEnd);
  if (start === end) return wall;
  const dayStart = Math.floor(wall / (DAY_MINUTES * MINUTE)) * (DAY_MINUTES * MINUTE);
  const minute = (wall - dayStart) / MINUTE;
  const quiet = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!quiet) return wall;
  const startedYesterday = start > end && minute < end;
  return dayStart + (start - (startedYesterday ? DAY_MINUTES : 0) - QUIET_BUFFER_MINUTES) * MINUTE;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function wallDate(wall: number) {
  const d = new Date(wall);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function wallTime(wall: number) {
  const d = new Date(wall);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** e.g. "Tue 21:30" */
export function fmtWall(wall: number) {
  return `${WEEKDAYS[new Date(wall).getUTCDay()].slice(0, 3)} ${wallTime(wall)}`;
}

/** When to start each prep step for a meal, after moving any out of quiet hours. */
export function prepSchedule(recipe: RecipeLike, date: string, meal: string, st: ReminderSettings) {
  const time = st.mealTimes[meal];
  if (!time) return [];
  const cook = toWall(date, time);
  return (recipe.prep || []).map((step, index) => ({
    ...step,
    index,
    wall: avoidQuietHours(cook - step.hoursBefore * 60 * MINUTE, st.quietStart, st.quietEnd),
  }));
}

function dayWord(mealDate: string, reminderWall: number) {
  const days = Math.round((toWall(mealDate, "00:00") - toWall(wallDate(reminderWall), "00:00")) / (DAY_MINUTES * MINUTE));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${WEEKDAYS[new Date(toWall(mealDate, "00:00")).getUTCDay()]}`;
}

/** Every reminder for these planned meals, due or not. */
export function allReminders(slots: { date: string; meal: string; recipe_id: string }[], recipes: Record<string, RecipeLike>, st: ReminderSettings): Reminder[] {
  const out: Reminder[] = [];
  for (const slot of slots) {
    const recipe = recipes[slot.recipe_id];
    const time = st.mealTimes[slot.meal];
    if (!recipe || !time || !st.meals.includes(slot.meal)) continue;
    const mealName = slot.meal.toLowerCase();
    const base = `${slot.date}|${slot.meal}|${recipe.id}`;
    if (st.reminders.prep) {
      for (const step of prepSchedule(recipe, slot.date, slot.meal, st)) {
        out.push({
          key: `${base}|prep:${step.index}`,
          at: wallToInstant(step.wall, st.timezone),
          title: step.task,
          body: `For ${recipe.title}: ${mealName} ${dayWord(slot.date, step.wall)} at ${time}.`,
        });
      }
    }
    if (st.reminders.cook) {
      out.push({
        key: `${base}|cook`,
        at: wallToInstant(toWall(slot.date, time), st.timezone),
        title: `Time to cook ${mealName}`,
        body: recipe.title,
      });
    }
  }
  return out;
}

/** Reminders that came due in the last `graceMinutes`. The grace period covers a late or skipped scheduler run. */
export function dueReminders(all: Reminder[], now: Date, graceMinutes = 60) {
  return all.filter((r) => r.at.getTime() <= now.getTime() && r.at.getTime() > now.getTime() - graceMinutes * MINUTE);
}
