"""pytest 根配置

把 EN-teach 根目录与 server/ 加入 sys.path, 并补上 config 必需的占位 env,
让单元测试在没有 .env 的干净环境也能跑 (只测纯逻辑, 不触网).
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # EN-teach/
SERVER = ROOT / "server"

for _p in (str(ROOT), str(SERVER)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# config.py 里这四个字段没有默认值, 补占位避免干净环境 import 失败
for _k, _v in {
    "NLS_APPKEY": "test-nls-appkey",
    "NLS_TOKEN": "test-nls-token",
    "SSECP_APP_ID": "test-ssecp-app-id",
    "SSECP_APP_SECRET": "test-ssecp-app-secret",
}.items():
    os.environ.setdefault(_k, _v)
