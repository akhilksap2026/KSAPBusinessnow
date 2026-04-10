import { db, tasksTable, taskDependenciesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addWorkingDays(date: Date, days: number): Date {
  const d = new Date(date);
  if (days === 0) return d;
  let remaining = Math.abs(days);
  const sign = days > 0 ? 1 : -1;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + sign);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return d;
}

function workingDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export type ScheduleResult = { updated: number } | { type: "cycle"; message: string };

export async function scheduleProject(projectId: number): Promise<ScheduleResult> {
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.projectId, projectId));
  if (tasks.length === 0) return { updated: 0 };

  const taskIds = tasks.map(t => t.id);
  const deps = await db.select().from(taskDependenciesTable)
    .where(inArray(taskDependenciesTable.taskId, taskIds));

  const predecessors: Record<number, { predecessorId: number; type: string; lag: number }[]> = {};
  const successors: Record<number, number[]> = {};
  tasks.forEach(t => { predecessors[t.id] = []; successors[t.id] = []; });

  for (const dep of deps) {
    predecessors[dep.taskId].push({
      predecessorId: dep.dependsOnTaskId,
      type: dep.dependencyType ?? "FS",
      lag: dep.lagDays ?? 0,
    });
    if (!successors[dep.dependsOnTaskId]) successors[dep.dependsOnTaskId] = [];
    successors[dep.dependsOnTaskId].push(dep.taskId);
  }

  const inDegree: Record<number, number> = {};
  tasks.forEach(t => { inDegree[t.id] = predecessors[t.id].length; });

  const queue: number[] = tasks.filter(t => inDegree[t.id] === 0).map(t => t.id);
  const sorted: number[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const succ of (successors[node] ?? [])) {
      inDegree[succ]--;
      if (inDegree[succ] === 0) queue.push(succ);
    }
  }

  if (sorted.length !== tasks.length) {
    const inCycle = tasks.filter(t => !sorted.includes(t.id));
    const names = inCycle.slice(0, 2).map(t => t.name).join(" and ");
    return { type: "cycle", message: `Schedule conflict: circular dependency detected between ${names}` };
  }

  const taskMap: Record<number, typeof tasks[0]> = {};
  tasks.forEach(t => { taskMap[t.id] = t; });

  const startMap: Record<number, Date | null> = {};
  const endMap: Record<number, Date | null> = {};
  const durationMap: Record<number, number> = {};

  for (const t of tasks) {
    const s = parseDate(t.plannedStartDate);
    const e = parseDate(t.plannedEndDate);
    startMap[t.id] = s;
    endMap[t.id] = e;
    durationMap[t.id] = s && e ? workingDaysBetween(s, e) : 5;
  }

  for (const tid of sorted) {
    const preds = predecessors[tid];
    if (preds.length === 0) continue;

    let candidateStart: Date | null = null;
    let candidateEnd: Date | null = null;

    for (const { predecessorId, type, lag } of preds) {
      const predStart = startMap[predecessorId];
      const predEnd = endMap[predecessorId];

      if (type === "FS" && predEnd) {
        const cs = addWorkingDays(predEnd, lag);
        if (!candidateStart || cs > candidateStart) candidateStart = cs;
      } else if (type === "SS" && predStart) {
        const cs = addWorkingDays(predStart, lag);
        if (!candidateStart || cs > candidateStart) candidateStart = cs;
      } else if (type === "FF" && predEnd) {
        const ce = addWorkingDays(predEnd, lag);
        if (!candidateEnd || ce > candidateEnd) candidateEnd = ce;
      } else if (type === "SF" && predStart) {
        const ce = addWorkingDays(predStart, lag);
        if (!candidateEnd || ce > candidateEnd) candidateEnd = ce;
      }
    }

    const dur = durationMap[tid];

    if (candidateStart && candidateEnd) {
      const endFromStart = addWorkingDays(candidateStart, dur);
      const finalEnd = endFromStart > candidateEnd ? endFromStart : candidateEnd;
      endMap[tid] = finalEnd;
      startMap[tid] = addWorkingDays(finalEnd, -dur);
    } else if (candidateStart) {
      startMap[tid] = candidateStart;
      endMap[tid] = addWorkingDays(candidateStart, dur);
    } else if (candidateEnd) {
      endMap[tid] = candidateEnd;
      startMap[tid] = addWorkingDays(candidateEnd, -dur);
    }
  }

  let updatedCount = 0;
  for (const tid of sorted) {
    const s = startMap[tid];
    const e = endMap[tid];
    const orig = taskMap[tid];
    const newS = s ? formatDate(s) : orig.plannedStartDate;
    const newE = e ? formatDate(e) : orig.plannedEndDate;
    if (newS !== orig.plannedStartDate || newE !== orig.plannedEndDate) {
      await db.update(tasksTable)
        .set({ plannedStartDate: newS, plannedEndDate: newE, updatedAt: new Date() })
        .where(eq(tasksTable.id, tid));
      updatedCount++;
    }
  }

  return { updated: updatedCount };
}
