!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 "1" vcredist_ja_instalado

    DetailPrint "Instalando Visual C++ Redistributable 2022..."
    ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /passive /norestart'

  vcredist_ja_instalado:
!macroend
