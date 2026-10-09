import sys
import os
import subprocess
import time
import webbrowser
from pathlib import Path
import urllib.request

def main():
    if getattr(sys, 'frozen', False):
        base_dir = Path(sys.executable).parent
    else:
        base_dir = Path(__file__).parent.resolve()
        
    engine_dir = base_dir / "engine"
    if not engine_dir.exists():
        engine_dir = base_dir
        
    # Check for compiled standalone engine executable first
    program_files = os.environ.get("ProgramFiles", "C:\\Program Files")
    engine_exe_candidates = [
        engine_dir / "law-assist-engine.exe",
        base_dir / "law-assist-engine.exe",
        base_dir / "ProAssist_Standalone" / "engine" / "law-assist-engine.exe",
        Path(program_files) / "ProAssist" / "engine" / "law-assist-engine.exe",
        Path("C:/Program Files/ProAssist/engine/law-assist-engine.exe"),
        base_dir / "build" / "engine_dist" / "law-assist-engine.exe",
    ]
    engine_exe = next((exe for exe in engine_exe_candidates if exe.exists()), None)
    
    CREATE_NO_WINDOW = 0x08000000

    def _engine_healthy() -> bool:
        try:
            with urllib.request.urlopen("http://localhost:8765/health", timeout=1) as resp:
                return resp.status == 200
        except Exception:
            return False

    # Reuse a running engine instead of spawning a duplicate that cannot bind the port
    if _engine_healthy():
        webbrowser.open("http://localhost:8765")
        return

    if engine_exe:
        cmd = [str(engine_exe)]
        cwd = str(engine_exe.parent)
    else:
        venv_python = engine_dir / ".venv_312" / "Scripts" / "python.exe"
        if venv_python.exists():
            py_cmd = str(venv_python)
        else:
            py_cmd = "python"
        cmd = [py_cmd, str(engine_dir / "api.py")]
        cwd = str(engine_dir)

    try:
        subprocess.Popen(cmd, cwd=cwd, creationflags=CREATE_NO_WINDOW)
    except Exception:
        subprocess.Popen(cmd, cwd=cwd)
        
    # Wait for engine readiness (first launch on old PCs can take 60-90s to unpack models)
    for _ in range(120):
        time.sleep(1)
        if _engine_healthy():
            break
            
    # Open local ProAssist workstation in default browser
    webbrowser.open("http://localhost:8765")

if __name__ == "__main__":
    main()
