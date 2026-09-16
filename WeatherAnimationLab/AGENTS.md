# Weather Animation Lab

Independent animation experiments authorized by the user. The main application in
`/home/karel/Documents/WeatherApp` is being edited by Claude: treat that directory
as READ ONLY. Do not edit its files, dependencies, assets, screenshots, or launch
configuration. This lab has its own dependencies, Electron profile, and window.

Target: a frameless 1316 × 1396 Linux/Wayland app window. Explore sunset, sunrise,
night thunderstorms, and snowfall at dawn with real-time GPU rendering. Visual
quality is the priority. Lab-only scene/time controls are allowed here; the final
application must follow actual weather and local solar time without scene controls.

No live weather, sound, location requests, or changes to the production app yet.
Use licensed assets and record sources. Test actual GPU output and keep capture
artifacts in this lab. The user especially loves Apple Weather sunrise and sunset.


## Current iteration — 16 September 2026

The lab is now checked out at `WeatherAnimationLab/` inside the hyprweather repo.
The old absolute paths above describe the original machine, not this checkout.
User authorized a flatter iOS-inspired composition, varied cloud origins/motion,
and fog/strong-wind studies with matching icons. See TASKS.md. Work stays in the
lab until the user approves it on their Linux monitor. Push coherent tested
updates for the user's pull/run feedback loop. Do not claim this is a finished
production background or that local offscreen FPS equals their hardware FPS.


## Approved second iteration — user decisions

Keep changes in the lab until the user validates them, then integrate separately.
Remove ground/horizon entirely, shift main light/cloud composition upward, and
fade from roughly halfway down into very dark navy. Sun/moon belong in the upper
third, off centre, with a continuous artistic time-of-day arc.
Provide both light snow and a blizzard. Mostly small distant flakes, very few
large nearby soft flakes. Snow inherits scene light; light snow can show a soft
sun, heavy snow must hide it and lose distant detail in a grey veil.
Night should be beautiful and dramatic, with rich stars and gentle twinkling.
Clouds must occlude stars. A luminous placeholder moon is explicitly approved;
real phase/position will be added later. No production integration in this step.
