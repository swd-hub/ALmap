@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo .txt ファイルのコピーを .geojson に作成します。
echo 元の .txt ファイルは削除されません。
echo このスクリプトは、現在のディレクトリ内のファイルを処理します。
echo.

set "count=0"
for %%f in (*.txt) do (
    set "old_name=%%f"
    set "new_name=%%~nf.geojson"
    
    REM 新しいファイル名が元のファイル名と同じでないことを確認（例: 元がtest.geojson.txtのような場合）
    if /i "!old_name!" equ "!new_name!" (
        echo スキップ: "!old_name!" は既に .geojson 拡張子を持っています（または拡張子の変更がありません）。
    ) else if exist "!old_name!" (
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
echo %count% 個の .geojson ファイルが作成されました。
pause