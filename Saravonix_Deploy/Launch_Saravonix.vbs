Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "engine"
WshShell.Run ".\.venv_312\Scripts\python.exe api.py", 0, False
WScript.Sleep 3000
WshShell.Run "http://localhost:8765"
