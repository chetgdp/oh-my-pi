# Tasks

Finished work lives in HISTORY.md (item 5 model parity, D1 login, D3
settings push). Current work: PIPELINE.md.

## Check

- [ ] Rule `~/.omp/agent/rules/pair.md` (trigger
      `(?i)\b(pair|pairing|human[- ]led)\b`) did not fire in another
      session on "eh, pair mode is on". It did fire in this session on
      pasted text containing "pair". Find out whether the rule engine
      was off for that session or the trigger is checked somewhere else.
      Start with `omp ttsr test -r ~/.omp/agent/rules/pair.md "eh, pair
      mode is on"`. Not webgui work; move to the right place once found.
