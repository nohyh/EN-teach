"""pytest 根配置：让测试能从仓库根目录或 server/ 目录运行。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # EN-teach/
SERVER = ROOT / "server"

for _p in (str(ROOT), str(SERVER)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

