' Uruchamia start_grant_crm_hidden.bat w pelni ukryty (bez okna konsoli).
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start_grant_crm_hidden.bat"
' 0 = okno ukryte, True = czekaj na zakonczenie
WshShell.Run """" & batPath & """", 0, False
