; TradeLink247 Weighbridge installer (Slint edition). Built by .github/workflows/weighbridge-slint.yml:
;   makensis /DVERSION=3.0.0 /DEXE=path\to\weighbridge-slint.exe installer.nsi
; 3.0+ installs for the whole PC (needs an administrator once): the exe in Program Files, the
; "TradeLink247Weighbridge" Windows service (indicator, bridge visits, camera, uploads, updates;
; starts at boot, restarted if it stops), and the screen started at every logon.
; Updates are run by the service itself, silently and without asking for an administrator.
; Switches: /S silent, /RUN start the screen when done (a 2.x app updating itself to 3.0).
; Data lives in %ProgramData%\TradeLink247 Weighbridge, writable by every user of the PC. It is
; never deleted, not even on uninstall. A 2.x install (per user) is removed; the service copies
; its data on its first start.

Unicode true
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef EXE
  !define EXE "..\target\release\weighbridge-slint.exe"
!endif
!ifndef OUTDIR
  !define OUTDIR "."
!endif

!define NAME "TradeLink247 Weighbridge"
!define APPEXE "TradeLink247 Weighbridge.exe"
!define SVC "TradeLink247Weighbridge"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\TradeLink247Weighbridge"
!define RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"

Name "${NAME} ${VERSION}"
OutFile "${OUTDIR}\TradeLink247-Weighbridge-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\${NAME}"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
ShowInstDetails nevershow

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${NAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "TradeLink247"
VIAddVersionKey "FileDescription" "${NAME} installer"
VIAddVersionKey "LegalCopyright" "TradeLink247"

Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Function .onInit
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_OK|MB_ICONSTOP "Run the installer as an administrator." /SD IDOK
    SetErrorLevel 740
    Quit
  ${EndIf}
FunctionEnd

; Stops the service (on an update it started this installer) without Windows starting it again,
; then closes every screen, including a 2.x app (same exe name).
!macro StopAll
  nsExec::Exec '"$SYSDIR\sc.exe" failure ${SVC} reset= 0 actions= ""'
  nsExec::Exec '"$SYSDIR\net.exe" stop ${SVC}'
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APPEXE}"'
!macroend

Section "Install"
  SetOutPath "$INSTDIR"
  !insertmacro StopAll

  ; wait up to 30 s for the exe to be let go of
  StrCpy $1 0
  ${If} ${FileExists} "$INSTDIR\${APPEXE}"
    wait:
      ClearErrors
      FileOpen $0 "$INSTDIR\${APPEXE}" a
      ${If} ${Errors}
        IntOp $1 $1 + 1
        ${If} $1 > 60
          MessageBox MB_OK|MB_ICONSTOP "Close ${NAME} and run the installer again." /SD IDOK
          nsExec::Exec '"$SYSDIR\net.exe" start ${SVC}'
          Abort
        ${EndIf}
        Sleep 500
        Goto wait
      ${EndIf}
      FileClose $0
  ${EndIf}

  File "/oname=${APPEXE}" "${EXE}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; the data folder: the marker tells the screens to use it and the service; every user may write
  ; (the screens save weighings into the same database)
  CreateDirectory "$APPDATA\${NAME}"
  FileOpen $0 "$APPDATA\${NAME}\.machine" w
  FileWrite $0 "Installed for the whole PC by ${NAME} ${VERSION}$\r$\n"
  FileClose $0
  nsExec::Exec '"$SYSDIR\icacls.exe" "$APPDATA\${NAME}" /grant *S-1-5-32-545:(OI)(CI)M /T /C /Q'

  ; the service: created on the first install, pointed at this exe on every one
  nsExec::Exec `"$SYSDIR\sc.exe" create ${SVC} binPath= "\"$INSTDIR\${APPEXE}\" --service" start= auto DisplayName= "${NAME}"`
  nsExec::Exec `"$SYSDIR\sc.exe" config ${SVC} binPath= "\"$INSTDIR\${APPEXE}\" --service" start= auto DisplayName= "${NAME}"`
  nsExec::Exec `"$SYSDIR\sc.exe" description ${SVC} "Reads the weighbridge indicator, records every vehicle on the bridge with a photo, uploads to TradeLink247 and installs updates."`
  ; started again 10 s after it stops for any reason other than a normal stop
  nsExec::Exec '"$SYSDIR\sc.exe" failure ${SVC} reset= 86400 actions= restart/10000/restart/10000/restart/30000'
  nsExec::Exec '"$SYSDIR\sc.exe" failureflag ${SVC} 1'
  ; waits until it is running, so the 2.x data is in place before the screen opens
  nsExec::Exec '"$SYSDIR\net.exe" start ${SVC}'

  ; the screen at every logon, for every user
  WriteRegStr HKLM "${RUN_KEY}" "${NAME}" '"$INSTDIR\${APPEXE}"'

  CreateShortCut "$DESKTOP\${NAME}.lnk" "$INSTDIR\${APPEXE}"
  CreateDirectory "$SMPROGRAMS\${NAME}"
  CreateShortCut "$SMPROGRAMS\${NAME}\${NAME}.lnk" "$INSTDIR\${APPEXE}"
  CreateShortCut "$SMPROGRAMS\${NAME}\Uninstall ${NAME}.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${NAME}"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "TradeLink247"
  WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APPEXE}"
  WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINST_KEY}" "NoRepair" 1

  ; this user's 2.x install (other users' are removed when their screen first opens)
  SetShellVarContext current
  StrCpy $2 "$LOCALAPPDATA\Programs\${NAME}"
  ${If} ${FileExists} "$2\Uninstall.exe"
    ExecWait '"$2\Uninstall.exe" /S _?=$2'
    Delete "$2\Uninstall.exe"
    RMDir "$2"
  ${EndIf}
  SetShellVarContext all

  ; open the screen as the signed-in user (explorer hands it to their desktop, not the admin's):
  ; after a normal install, or /RUN. Updates run by the service reopen the screens themselves.
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/RUN" $R1
  ${If} ${Errors}
    ${IfNot} ${Silent}
      Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APPEXE}"'
    ${EndIf}
  ${Else}
    Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APPEXE}"'
  ${EndIf}
SectionEnd

Function un.onInit
  SetShellVarContext all
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
FunctionEnd

Section "Uninstall"
  !insertmacro StopAll
  nsExec::Exec '"$SYSDIR\sc.exe" delete ${SVC}'
  Sleep 1000
  Delete "$INSTDIR\${APPEXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\${NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${NAME}"
  DeleteRegValue HKLM "${RUN_KEY}" "${NAME}"
  DeleteRegKey HKLM "${UNINST_KEY}"
SectionEnd
