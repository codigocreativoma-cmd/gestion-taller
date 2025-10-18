; Script para el instalador de ServiTech con Inno Setup

[Setup]
AppName=ServiTech Gestor de Taller
AppVersion=1.0
DefaultDirName={autopf}\ServiTech
DefaultGroupName=ServiTech
UninstallDisplayIcon={app}\favicon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
OutputBaseFilename=ServiTech-Instalador-v1.0
PrivilegesRequired=admin

[Dirs]
; Crea la carpeta de datos en ProgramData
Name: "{commonappdata}\ServiTech"

[Files]
; Copia el ejecutable del servidor al directorio de instalación
Source: "backend\dist\server.exe"; DestDir: "{app}"; Flags: ignoreversion

; Copia la herramienta NSSM al directorio de instalación para usarla
; --- ¡IMPORTANTE! Ajusta esta ruta a donde descomprimiste NSSM ---
Source: "C:\NSSM\win64\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

; --- CAMBIO CLAVE 1: Copia el archivo del icono a la carpeta de instalación ---
Source: "frontend\img\favicon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Crea el acceso directo en el escritorio que abre el navegador
; --- CAMBIO CLAVE 2: Asigna el archivo de icono al acceso directo ---
Name: "{autodesktop}\ServiTech Gestor"; Filename: "http://localhost:3000/login.html"; IconFilename: "{app}\favicon.ico"

; Crea un desinstalador en el Menú Inicio
Name: "{group}\Desinstalar ServiTech"; Filename: "{uninstallexe}"

[Run]
; Instala el servicio de Windows de forma silenciosa
Filename: "{app}\nssm.exe"; Parameters: "install ServiTech ""{app}\server.exe"""; Flags: runhidden
; Configura el servicio para que se inicie automáticamente
Filename: "{app}\nssm.exe"; Parameters: "set ServiTech Start SERVICE_AUTO_START"; Flags: runhidden
; Inicia el servicio por primera vez
Filename: "{app}\nssm.exe"; Parameters: "start ServiTech"; Flags: runhidden

[UninstallRun]
; Al desinstalar, detiene y elimina el servicio antes de borrar los archivos
Filename: "{app}\nssm.exe"; Parameters: "stop ServiTech"; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "remove ServiTech confirm"; Flags: runhidden