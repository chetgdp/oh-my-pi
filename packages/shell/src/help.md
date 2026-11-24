? <prompt>                   prompt the attached session (steers it if busy)
? /f <prompt>                queue as a follow-up after the current turn
? /attach (/a) [--id <id>]   attach this pane to a live session
? /resume (/r) [--all|--id <id>]
                             resume a past session and attach
? /new (/n) [--omem] [text]  start a new host here and attach
? /last (/l)                 print the last assistant reply again
? /m [model]                 show or switch the model (/model)
? /u                         provider usage and limits (/usage)
? /clear (/c)                empty the session context
? /tools                     tools of the attached session
? /output [default|N|all]    result lines under each tool line
? /status (/st)              settings, pane binding, session state
? /plan [prompt]             toggle plan mode
? /export [N|--html [path]]  transcript as markdown, or HTML file
? /diff [instruction]        prompt with the uncommitted diff
? /perms                     pick the tool approval mode
? --ask|--ask-cached|--write|--yolo [prompt]
                             set the approval mode, then prompt
? /stop [--id <id>]          abort and shut down a live session
? /sub                       attach this pane to a running subagent
? /main                      go back to the main session
? /help (/h)                 this list
cmd | ? <prompt>             piped stdin is appended to the prompt

Chains: ? /l /m opus-5.5 fix the bug
Other /commands go to the host unchanged.
omp-shell --setup installs ? for fish, bash and zsh.
