#!/usr/bin/env python3
"""AI GUI Computer Use Bridge — JSON-RPC over stdio.

Reads JSON-RPC requests from stdin (newline-delimited),
dispatches to action handlers, writes responses to stdout.
All logs go to stderr to keep stdio clean.
"""

import json
import sys
import base64
import io
import time
import traceback

try:
    import mss
    import mss.base
except ImportError:
    mss = None

try:
    import pyautogui
except ImportError:
    pyautogui = None

try:
    from PIL import Image
except ImportError:
    Image = None

MAX_IMAGE_DIMENSION = 1568
_request_id_counter = 0


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def screenshot(params: dict) -> dict:
    if mss is None:
        return {"error": "mss not installed"}
    if Image is None:
        return {"error": "Pillow not installed"}

    monitor_index = params.get("monitor", 0)
    with mss.mss() as sct:
        if monitor_index >= len(sct.monitors):
            monitor_index = 0
        monitor = sct.monitors[monitor_index] if monitor_index > 0 else sct.monitors[0]
        shot = sct.grab(monitor)

        img = Image.frombytes("RGB", shot.size, shot.rgb)

        orig_w, orig_h = img.size
        scale = 1.0
        if max(orig_w, orig_h) > MAX_IMAGE_DIMENSION:
            scale = MAX_IMAGE_DIMENSION / max(orig_w, orig_h)
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        final_w, final_h = img.size
        return {
            "base64": b64,
            "width": final_w,
            "height": final_h,
            "orig_width": orig_w,
            "orig_height": orig_h,
            "scale": scale,
        }


def screen_size(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    w, h = pyautogui.size()
    return {"width": w, "height": h}


def click(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    x = int(params.get("x", 0))
    y = int(params.get("y", 0))
    button = params.get("button", "left")
    pyautogui.click(x=x, y=y, button=button)
    return {"success": True}


def double_click(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    x = int(params.get("x", 0))
    y = int(params.get("y", 0))
    pyautogui.doubleClick(x=x, y=y)
    return {"success": True}


def mouse_move(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    x = int(params.get("x", 0))
    y = int(params.get("y", 0))
    pyautogui.moveTo(x=x, y=y)
    return {"success": True}


def type_text(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    text = params.get("text", "")
    pyautogui.write(text, interval=0.02)
    return {"success": True}


def key_press(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    keys = params.get("keys", [])
    if len(keys) == 1:
        pyautogui.press(keys[0])
    elif len(keys) > 1:
        pyautogui.hotkey(*keys)
    return {"success": True}


def scroll(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    x = int(params.get("x", 0))
    y = int(params.get("y", 0))
    amount = int(params.get("amount", 3))
    pyautogui.scroll(amount, x=x, y=y)
    return {"success": True}


def drag(params: dict) -> dict:
    if pyautogui is None:
        return {"error": "pyautogui not installed"}
    from_x = int(params.get("fromX", 0))
    from_y = int(params.get("fromY", 0))
    to_x = int(params.get("toX", 0))
    to_y = int(params.get("toY", 0))
    pyautogui.moveTo(from_x, from_y)
    pyautogui.drag(to_x - from_x, to_y - from_y, duration=0.3)
    return {"success": True}


def ping(params: dict) -> dict:
    return {"pong": True}


HANDLERS = {
    "ping": ping,
    "screenshot": screenshot,
    "screen_size": screen_size,
    "click": click,
    "double_click": double_click,
    "mouse_move": mouse_move,
    "type_text": type_text,
    "key_press": key_press,
    "scroll": scroll,
    "drag": drag,
}


def handle_request(req: dict) -> dict:
    rid = req.get("id", 0)
    method = req.get("method", "")
    params = req.get("params", {})

    handler = HANDLERS.get(method)
    if handler is None:
        return {"id": rid, "error": {"code": -32601, "message": f"Method not found: {method}"}}

    try:
        result = handler(params)
        if "error" in result:
            return {"id": rid, "error": {"code": -32000, "message": result["error"]}}
        return {"id": rid, "result": result}
    except Exception as e:
        log(f"Error handling {method}: {traceback.format_exc()}")
        return {"id": rid, "error": {"code": -32603, "message": str(e)}}


def main() -> None:
    log("AI GUI Computer Use Bridge started")
    log(f"Available methods: {list(HANDLERS.keys())}")

    if pyautogui:
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.1
        log(f"Screen size: {pyautogui.size()}")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps({"id": 0, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            sys.stdout.flush()
            continue

        response = handle_request(req)
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()

    log("Bridge shutting down")


if __name__ == "__main__":
    main()
