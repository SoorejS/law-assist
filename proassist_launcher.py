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
        
    venv_python = engine_dir / ".venv_312" / "Scripts" / "python.exe"
    if venv_python.exists():
        py_cmd = str(venv_python)
    else:
        py_cmd = "python"
        
    api_script = str(engine_dir / "api.py")
    
    CREATE_NO_WINDOW = 0x08000000
    try:
        subprocess.Popen([py_cmd, api_script], cwd=str(engine_dir), creationflags=CREATE_NO_WINDOW)
    except Exception as e:
        # Fallback without flag if on non-windows
        subprocess.Popen([py_cmd, api_script], cwd=str(engine_dir))
        
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
