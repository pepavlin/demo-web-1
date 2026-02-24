"use client";

import { useState, useEffect, useCallback } from "react";

const TASKS_URL =
  "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";

const POLL_INTERVAL = 30_000;

export interface Task {
  id?: string | number;
  status?: string;
  message?: string;
  title?: string;
  name?: string;
}

export function parseTasks(raw: unknown): Task[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return [];
  }

  let items: unknown[];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.tasks)) items = obj.tasks;
    else if (Array.isArray(obj.data)) items = obj.data;
    else if (Array.isArray(obj.items)) items = obj.items;
    else return [];
  } else {
    return [];
  }

  return items.filter(
    (item): item is Task => item !== null && typeof item === "object"
  ) as Task[];
}

export function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(TASKS_URL);
      if (!res.ok) {
        setTasks([]);
        return;
      }
      const data: unknown = await res.json();
      setTasks(parseTasks(data));
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTasks]);


  return tasks;
}
