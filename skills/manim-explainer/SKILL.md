---
name: manim-explainer
description: Create animated explanations of concepts with Manim, using visual storytelling inspired by 3Blue1Brown. Use when asked to explain, teach, storyboard, or render a concept as a mathematical or scientific animation.
compatibility: Requires Python, Manim Community Edition, and FFmpeg; LaTeX is needed for typeset mathematics.
---

# Manim concept explainer

Create an original, accurate visual explanation, not a copy of a particular video or its assets. Use Manim Community Edition (ManimCE, `manim`), not 3Blue1Brown's separate ManimGL (`manimgl`, `manimlib`). Do not assume their APIs are interchangeable.

## Plan the explanation

1. Identify the audience, desired language, output format, and central insight. Use reasonable defaults when unspecified; ask only when a missing detail blocks the work.
2. Check the mathematics and any assumptions. Choose a concrete example or question before introducing general notation. State limitations and avoid implying that an illustrative example is a proof.
3. Make a short storyboard: for each beat, specify the visual, the change, and the point it communicates. Move from example to intuition to a concise general statement. Include narration or captions when requested; do not claim silent video has narration.
4. Favor a clear visual model over decorative motion: transform objects to show causal relationships, preserve visual anchors and consistent color meanings, and introduce labels only when needed. Use high contrast, sparse text, readable equations, deliberate pacing, and pauses. Ensure motion reinforces the explanation. Do not reuse 3Blue1Brown artwork, characters, music, or footage without permission.

## Environment

First inspect the project's instructions, existing Python environment, dependency files, and Manim version. Reuse a compatible setup; do not replace or modify an existing environment or install system packages without permission. If setup is missing, explain what is needed and obtain permission before installing dependencies or creating a new environment.

For a new isolated project, use a Python version supported by the chosen ManimCE release (check its current PyPI metadata; Python 3.12 is a practical starting point). For example, on macOS/Linux, in a new project directory:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install manim
.venv/bin/python -m manim --version
.venv/bin/python -m manim checkhealth
```

On Windows use `py -3.12 -m venv .venv` and `.venv\Scripts\python.exe` in place of `.venv/bin/python`. If that Python version is unavailable, use an installed supported version or ask before installing one. Respect an existing lockfile; for a new reproducible project, record the Python and Manim versions and pin or lock dependencies.

FFmpeg must be available for video output. On Linux, installing Manim may require a compiler, `pkg-config`, and Cairo/Pango development packages; follow the official installation instructions for the OS. `Tex` and `MathTex` also need a working LaTeX distribution and its required packages; ordinary `Text` does not. Check required tools before rendering, and report actionable errors rather than silently switching environments. See https://docs.manim.community/en/stable/installation.html and https://pypi.org/project/manim/ for current requirements.

## Implement and render

- Write self-contained `Scene` subclasses, using ManimCE APIs and explicit, meaningful scene names. Keep the source and output in the requested project location; avoid overwriting unrelated files. Use mathematical labels, units, ranges, and transformations that match the explanation.
- Develop one conceptual beat at a time. For example, with the environment above:

```sh
.venv/bin/python -m manim -ql scene.py SceneName
.venv/bin/python -m manim -qh scene.py SceneName
```

The first command renders a low-quality preview; the second renders high quality. Add `-p` only when opening a local player is appropriate. Manim normally writes to `media/`; report the actual output path. Adapt commands to the project's environment and requested quality.
- Render a preview, inspect representative frames and, when possible, playback for clipping, overlaps, legibility, timing, and mathematical correctness. Revise and render the deliverable. A successful command alone does not verify visual quality. If inspection or rendering is unavailable, say what was and was not verified.
- When narration is requested, provide a beat-aligned script and produce audio only if a suitable tool and permission are available. Sync and check the final audio/video when possible; otherwise provide the separate assets and clear assembly instructions.
- Return paths to the source and rendered artifacts, how to reproduce the render, and any unresolved limitations.

## References

- 3Blue1Brown's advice on concrete examples, visual explanation, and purposeful animation: https://www.3blue1brown.com/about/
- Behind the scenes: https://www.3blue1brown.com/lessons/manim-demo/
- ManimCE quickstart and CLI: https://docs.manim.community/en/stable/tutorials/quickstart.html
- ManimCE versus other versions: https://docs.manim.community/en/stable/faq/installation.html
