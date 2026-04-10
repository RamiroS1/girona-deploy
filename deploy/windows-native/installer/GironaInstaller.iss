#define MyAppName "Girona POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Girona"
#define MyAppExeName "launch-girona.bat"

[Setup]
AppId={{7BDB263F-0E3A-4D6D-B3A2-1F19B8E2C3C1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\GironaSW
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=GironaSetup
SetupIconFile=..\..\..\girona-front\public\images\favicon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear icono en escritorio"; GroupDescription: "Accesos directos:"

[Files]
Source: "..\..\..\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: ".git\*,node_modules\*,logs\*,girona-front\.next\cache\*,*.log"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\girona-front\public\images\favicon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\girona-front\public\images\favicon.ico"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\deploy\windows-native\quick-install.ps1"" -ProjectRoot ""{app}"""; Description: "Ejecutar instalacion asistida ahora"; Flags: postinstall waituntilterminated
