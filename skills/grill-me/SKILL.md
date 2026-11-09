---
name: grill-me
description: Interview the user to stress-test and clarify a plan, design, decision, or idea.
disable-model-invocation: true
---

# Grill me

Interview the user until you reach a shared understanding. Treat the subject as a tree of decisions and their dependencies.

- Ask in rounds: include all independent questions whose prerequisites are settled. Defer dependent questions to later rounds.
- Number each question, give your recommended answer, and phrase it so “yes” accepts that recommendation. Wait for the user's answers before the next round.
- Investigate facts you can find yourself rather than asking the user. If subagents are available, use them for independent exploration without delaying unrelated questions.
- Leave decisions to the user. Reassess the remaining questions after each round.
- Finish when the important branches are resolved. Do not implement or otherwise act on the outcome until the user confirms shared understanding.
