"""验证时间线落盘顺序及慢客户端的恢复信号。"""

import asyncio
import json
import threading
from pathlib import Path

import pytest

from nanomuse.server.events import EventBus, Timeline


@pytest.mark.asyncio
async def test_shutdown_snapshot_cannot_be_overwritten_by_old_worker(tmp_path: Path) -> None:
    timeline = Timeline("audit", tmp_path / "timeline.json")
    started = threading.Event()
    release = threading.Event()
    write = timeline._write

    def delayed(payload: str, revision: int) -> None:
        # 故意让旧后台快照晚于退出快照抵达写入锁。
        started.set()
        assert release.wait(5)
        write(payload, revision)

    timeline._write = delayed
    timeline.add({"id": "old"})
    assert timeline._flush_handle is not None
    timeline._flush_handle.cancel()
    timeline._flush_later(asyncio.get_running_loop())
    try:
        assert await asyncio.to_thread(started.wait, 2)
        timeline._write = write
        timeline.add({"id": "new"})
        timeline.flush()
    finally:
        release.set()
        assert timeline._writing is not None
        await timeline._writing
    assert [event["id"] for event in json.loads(timeline.path.read_text("utf-8"))["events"]] == [
        "old",
        "new",
    ]


def test_failed_write_can_retry_the_same_revision(tmp_path: Path) -> None:
    timeline = Timeline("audit", tmp_path / "timeline.json")
    write = timeline._write_snapshot

    def fail(_payload: str) -> None:
        raise OSError("disk unavailable")

    timeline._write_snapshot = fail
    with pytest.raises(OSError, match="disk unavailable"):
        timeline.add({"id": "kept"})
    timeline._write_snapshot = write
    timeline.flush()
    assert json.loads(timeline.path.read_text("utf-8"))["events"][0]["id"] == "kept"


def test_overflow_requires_resync_without_affecting_other_subscribers() -> None:
    bus = EventBus()
    slow, fast = bus.subscribe(), bus.subscribe()
    for index in range(slow.maxsize + 1):
        bus.publish({"kind": "event", "index": index})
        assert fast.get_nowait()["index"] == index
    assert slow.get_nowait() == {"kind": "resync"}
    assert slow.empty()
    assert bus.connections == 1
    bus.publish({"kind": "latest"})
    assert fast.get_nowait() == {"kind": "latest"}
    # 重新订阅后继续收到实时消息，完整状态由 WebSocket 的 hello 帧提供。
    restored = bus.subscribe()
    bus.publish({"kind": "restored"})
    assert restored.get_nowait() == {"kind": "restored"}
