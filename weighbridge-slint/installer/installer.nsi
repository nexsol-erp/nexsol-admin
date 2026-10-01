; TradeLink247 Weighbridge installer (Slint edition). Built by .github/workflows/weighbridge-slint.yml:
;   makensis /DVERSION=2.0.0 /DEXE=path\to\weighbridge-slint.exe installer.nsi
; Installs for the current Windows user (no admin prompt, so updates can install silently).
; Switches: /S silent (used by the in-app updater), /RUN start the app when done.
; The data folder (%APPDATA%\TradeLink247 Weighbridge) is never touched, not even on uninstall.

Unicode true
!include "FileFunc.nsh"
!include "LogicLib.nsh"

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
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\TradeLink247Weighbridge"

Name "${NAME} ${VERSION}"
OutFile "${OUTDIR}\TradeLink247-Weighbridge-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${NAME}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails nevershow

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${NAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "TradeLink247"
VIAddVersionKey "FileDescription" "${NAME} installer"
VIAddVersionKey "LegalCopyright" "TradeLink247"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"

  ; The updater starts us and then quits; wait up to 30 s for the old app to let go of its exe.
  StrCpy $1 0
  ${If} ${FileExists} "$INSTDIR\${APPEXE}"
    wait:
      ClearErrors
      FileOpen $0 "$INSTDIR\${APPEXE}" a
      ${If} ${Errors}
        IntOp $1 $1 + 1
        ${If} $1 > 60
          MessageBox MB_OK|MB_ICONSTOP "Close ${NAME} and run the installer again." /SD IDOK
          Abort
        ${EndIf}
        Sleep 500
        Goto wait
      ${EndIf}
      FileClose $0
  ${EndIf}

  File "/oname=${APPEXE}" "${EXE}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortCut "$DESKTOP\${NAME}.lnk" "$INSTDIR\${APPEXE}"
  CreateDirectory "$SMPROGRAMS\${NAME}"
  CreateShortCut "$SMPROGRAMS\${NAME}\${NAME}.lnk" "$INSTDIR\${APPEXE}"
  CreateShortCut "$SMPROGRAMS\${NAME}\Uninstall ${NAME}.lnk" "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "TradeLink247"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APPEXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1

  ; /RUN: "Restart to update" in the app
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/RUN" $R1
  ${IfNot} ${Errors}
    Exec '"$INSTDIR\${APPEXE}"'
  ${EndIf}
SectionEnd

Function .onInstSuccess
  ; a normal (not silent) install starts the app at the end
  ${IfNot} ${Silent}
    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/RUN" $R1
    ${If} ${Errors}
      Exec '"$INSTDIR\${APPEXE}"'
    ${EndIf}
  ${EndIf}
FunctionEnd

Section "Uninstall"
  Delete "$INSTDIR\${APPEXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\${NAME}.lnk"
  RMDir /r "$SMPROGRAMS\${NAME}"
  DeleteRegKey HKCU "${UNINST_KEY}"
SectionEnd
