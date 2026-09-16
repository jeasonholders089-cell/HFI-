"use client";

import { useCallback, useState } from "react";
import type { TaskDTO } from "@inferencesh/sdk";
import { runInference } from "@/lib/inference";

type State = { loading: boolean; error: string | null; task: TaskDTO | null };

/** 包裹 runInference 的 loading/error/task 状态机; run() 抛错时也会落进 error. */
export function useInferenceRun() {
  const [state, setState] = useState<State>({ loading: false, error: null, task: null });

  const run = useCallback(
    async (app: string, input: Record<string, unknown>, opts?: { maxReconnects?: number }) => {
      setState({ loading: true, error: null, task: null });
      try {
        const task = await runInference(app, input, opts);
        setState({ loading: false, error: null, task });
        return task;
      } catch (e) {
        setState({ loading: false, error: e instanceof Error ? e.message : String(e), task: null });
        throw e;
      }
    },
    [],
  );

  return { ...state, run };
}
