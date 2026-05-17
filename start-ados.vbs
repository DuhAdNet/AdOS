Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Eduardo AdNet\AdOS"
WshShell.Run "cmd /c node_modules\.bin\electron.cmd .", 0, False
