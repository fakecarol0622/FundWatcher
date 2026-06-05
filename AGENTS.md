# Project Instructions

## Chinese Text And Encoding

- Do not assume Chinese mojibake in terminal output means the source file is corrupted.
- If Chinese appears as garbled text such as `鏈`, `鍩`, or `浼`, first treat it as a PowerShell/terminal encoding display issue.
- Before editing Chinese text, re-read the file as UTF-8, for example with `Get-Content -Encoding UTF8`, and verify the actual source content.
- Do not rewrite or "fix" Chinese labels based only on garbled shell output.
- If a Chinese text change is necessary, keep the existing wording unless the user explicitly asks to rename it.
