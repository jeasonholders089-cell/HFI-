/**
 * 对比位状态机（docs/08 §5.3）。
 *
 * 抽成纯函数而不是写在组件里，是为了让那条**最关键的不变量**能被直接测到：
 * `BROWSE` 只改浏览位，**不动 slots** —— 这是"浏览与收集分离"这条产品逻辑的落点。
 */

/** 对比位上限（docs/05 F1）。 */
export const SLOT_MAX = 3;

export type SlotState = { browsing: string | null; slots: string[] };

export type SlotAction =
  | { type: "BROWSE"; en: string }
  | { type: "CLOSE_BROWSE" }
  | { type: "ADD"; en: string }
  | { type: "REMOVE"; en: string }
  | { type: "CLEAR" };

export function initialSlotState(): SlotState {
  return { browsing: null, slots: [] };
}

export function slotReducer(state: SlotState, action: SlotAction): SlotState {
  switch (action.type) {
    case "BROWSE":
      // 只改浏览位。**slots 原样返回**（同引用，便于测试断言）
      return { ...state, browsing: action.en };
    case "CLOSE_BROWSE":
      return { ...state, browsing: null };
    case "ADD": {
      if (state.slots.includes(action.en)) return state;
      if (state.slots.length >= SLOT_MAX) return state;
      return { ...state, slots: [...state.slots, action.en] };
    }
    case "REMOVE":
      return { ...state, slots: state.slots.filter((x) => x !== action.en) };
    case "CLEAR":
      return { ...state, slots: [] };
  }
}

/** 开发模式下断言的不变量（docs/08 §5.3）。 */
export function checkInvariants(state: SlotState, known: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  if (state.slots.length > SLOT_MAX) problems.push(`slots 超过上限：${state.slots.length}`);
  if (new Set(state.slots).size !== state.slots.length) problems.push("slots 里有重复项");
  for (const en of state.slots) if (!known.has(en)) problems.push(`slots 里的 ${en} 不在数据集中`);
  return problems;
}

/** 能否并排对比：至少 2 所。 */
export function canCompare(state: SlotState): boolean {
  return state.slots.length >= 2;
}

/** 对比位是否已满（满员时未加入的院校按钮要置灰）。 */
export function slotsFull(state: SlotState): boolean {
  return state.slots.length >= SLOT_MAX;
}
