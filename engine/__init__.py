import sys
from pathlib import Path

# Ensure engine directory is always in sys.path so modules can import peers
engine_dir = str(Path(__file__).parent.resolve())
if engine_dir not in sys.path:
    sys.path.insert(0, engine_dir)
