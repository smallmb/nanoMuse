import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { api, connectWs } from "./api";
import { StoreProvider, useStore, type AppState } from "./store";
import type { StateSnapshot, TimelineEvent } from "./types";

vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return {
    ...original,
    getToken: vi.fn(),
    connectWs: vi.fn(),
    api: { ...original.api, state: vi.fn(), events: vi.fn(), goals: vi.fn() },
  };
});
vi.mock("./push", () => ({ registerWorker: vi.fn(), setAppBadge: vi.fn() }));
vi.mock("./theme", () => ({ useTheme: () => "light" }));

let screen: ReactTestRenderer | undefined;

afterEach(() => {
  act(() => screen?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("收到重连快照后重载当前对话，补回断线期间的消息", async () => {
  vi.useFakeTimers();
  // 只提供 Store 的浏览器生命周期所需接口，不依赖真实页面和网络。
  const browser = {
    location: { href: "http://localhost/", origin: "http://localhost" },
    setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
  Object.assign(browser, { parent: browser });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("navigator", {});
  vi.mocked(connectWs).mockReturnValue({ send: () => true, close: vi.fn() });
  const thread = { id: "main", title: "main", created_at: "2026-10-23T00:00:00Z", updated_at: "2026-10-23T00:00:00Z", busy: false, queued: 0, events: 1 };
  const snapshot = {
    version: "audit", profile: { name: "audit" },
    status: { state: "idle", detail: "", thread: "main" },
    threads: [thread], pending_approvals: [], goals: [], settings: {},
  } as unknown as StateSnapshot;
  const old: TimelineEvent = { id: "old", type: "user", text: "之前", thread: "main", ts: "2026-10-23T00:00:00Z" };
  const missed: TimelineEvent = { ...old, id: "missed", text: "断线期间" };
  vi.mocked(api.state).mockResolvedValue(snapshot);
  vi.mocked(api.goals).mockResolvedValue([]);
  vi.mocked(api.events).mockResolvedValue({ thread, events: [old], has_more: false });
  let current: AppState | undefined;
  function Probe() {
    current = useStore().state;
    return null;
  }
  await act(async () => { screen = create(createElement(StoreProvider, null, createElement(Probe))); });
  expect(current?.events.main?.map((event) => event.id)).toEqual(["old"]);
  const handlers = vi.mocked(connectWs).mock.calls[0]?.[0];
  if (!handlers) throw Error("连接回调未注册");
  await act(async () => { handlers.onOpen?.(); });
  await act(async () => { handlers.onClose?.(); });
  await act(async () => { handlers.onOpen?.(); });
  vi.mocked(api.events).mockResolvedValue({ thread, events: [old, missed], has_more: false });
  const before = vi.mocked(api.events).mock.calls.length;
  await act(async () => {
    handlers.onMessage({ kind: "hello", state: snapshot });
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(api.events).toHaveBeenCalledTimes(before + 1);
  expect(current?.events.main?.map((event) => event.id)).toEqual(["old", "missed"]);
});
