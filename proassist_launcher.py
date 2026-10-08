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
    engine_exe_candidates = [
        engine_dir / "law-assist-engine.exe",
        base_dir / "law-assist-engine.exe",
        base_dir / "build" / "engine_dist" / "law-assist-engine.exe",
    ]
    engine_exe = next((exe for exe in engine_exe_candidates if exe.exists()), None)
    
    CREATE_NO_WINDOW = 0x08000000
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
        
    # Wait for engine readiness
    for _ in range(12):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://localhost:8765/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            pass
            
    # Open local ProAssist workstation in default browser
    webbrowser.open("http://localhost:8765")

if __name__ == "__main__":
    main()
