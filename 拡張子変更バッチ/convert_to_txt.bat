@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo .geojson ファイルのコピーを .txt に作成します。
echo 元の .geojson ファイルは削除されません。
echo このスクリプトは、現在のディレクトリ内のファイルを処理します。
echo.

set "count=0"
for %%f in (*.geojson) do (
    set "old_name=%%f"
    set "new_name=%%~nf.txt"
    
    if exist "!old_name!" (
        echo コピー中: "!old_name!" -> "!new_name!"
        copy /Y "!old_name!" "!new_name!"
        
        if exist "!new_name!" (
            echo コピーが完了しました。
            set /a count+=1
        ) else (
            echo エラー: "!old_name!" のコピーに失敗しました。
        )
    ) else (
        echo 警告: "!old_name!" が見つかりません（既に処理されたか削除された可能性があります）。
    )
)

echo.
echo 処理が完了しました。
echo %count% 個の .txt ファイルが作成されました。
pause