!include "MUI2.nsh"

Name "ProAssist AI Workstation"
OutFile "..\releases\ProAssist-Setup.exe"
InstallDir "$PROGRAMFILES64\ProAssist"
RequestExecutionLevel admin

!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "ProAssist Core" SecCore
  ; Stop any running (older) copies so files can be replaced and port 8765 is freed
  nsExec::Exec 'taskkill /F /IM law-assist-engine.exe /T'
  nsExec::Exec 'taskkill /F /IM ProAssist.exe /T'
  Sleep 1500

  SetOutPath "$INSTDIR"

  ; Remove stale UI bundle from previous versions
  RMDir /r "$INSTDIR\ui"
  
  ; Include all files from portable_staging
  File /r "portable_staging\*"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Create start menu shortcut
  CreateDirectory "$SMPROGRAMS\ProAssist"
  CreateShortcut "$SMPROGRAMS\ProAssist\ProAssist.lnk" "$INSTDIR\ProAssist.exe" "" "$INSTDIR\icons\icon.ico" 0
  
  ; Create desktop shortcut
  CreateShortcut "$DESKTOP\ProAssist.lnk" "$INSTDIR\ProAssist.exe" "" "$INSTDIR\icons\icon.ico" 0
  
  ; Write uninstall info in registry
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist" "DisplayName" "ProAssist AI Workstation"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist" "Publisher" "ProAssist"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist" "DisplayVersion" "1.0.1"
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM law-assist-engine.exe /T'
  nsExec::Exec 'taskkill /F /IM ProAssist.exe /T'
  Sleep 1500

  Delete "$SMPROGRAMS\ProAssist\ProAssist.lnk"
  RMDir "$SMPROGRAMS\ProAssist"
  Delete "$DESKTOP\ProAssist.lnk"
  
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProAssist"
SectionEnd
