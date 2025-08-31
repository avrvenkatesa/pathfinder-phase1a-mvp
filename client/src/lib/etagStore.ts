// client/src/lib/etagStore.ts
type Scope = "contact";

type ETagState = {
  [scope in Scope]?: { [id: string]: string };
};

const STORAGE_KEY = "etag:v1";
let state: ETagState = {};

// load once per tab
try {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) state = JSON.parse(raw);
} catch {
  state = {};
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export const ETagStore = {
  get(scope: Scope, id: string): string | null {
    return state[scope]?.[id] ?? null;
  },
  set(scope: Scope, id: string, etag: string) {
    state[scope] ||= {};
    state[scope]![id] = etag;
    persist();
  },
  remove(scope: Scope, id: string) {
    if (state[scope]) {
      delete state[scope]![id];
      persist();
    }
  },
};