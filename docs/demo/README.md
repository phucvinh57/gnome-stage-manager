# Remotion demo

This project renders the animated walkthrough embedded in the root README.
It illustrates the extension’s behavior with drawn application windows; it is
not a GNOME session recording or a runtime compatibility test.

## Output

- Video: [`../media/stage-manager-demo.mp4`](../media/stage-manager-demo.mp4)
- Composition: `StageManager`, 1920 × 1080, 30 fps, 270 frames (9 seconds)
- Format: silent H.264 MP4, YUV 4:2:0, with on-screen explanations

All artwork is drawn in React/CSS/SVG. There are no external images, remote font
requests, recordings, or audio assets. The composition uses Ubuntu when installed
and falls back to Arial/sans-serif; install Ubuntu fonts to match the checked-in
render. Remotion and React are pinned in this directory’s package and lock files,
separate from the extension’s development dependencies.

## Rebuild

Use Node.js 22 or newer and npm. From the repository root:

```sh
npm --prefix docs/demo ci
npm --prefix docs/demo run studio
npm --prefix docs/demo run render
```

Remotion can download a compatible browser automatically. To use an existing
Chrome installation, append its path to the render command:

```sh
npm --prefix docs/demo run render -- --browser-executable=/usr/bin/google-chrome
```

See Remotion’s [composition fundamentals](https://www.remotion.dev/docs/idea)
and [render CLI reference](https://www.remotion.dev/docs/cli/render).

## Storyboard

| Time | Action |
| --- | --- |
| 0–1.5 s | Overlapping windows; turn on Stage Manager in the top bar |
| 1.5–4.7 s | Notes fills the managed area; Browser and Files become previews |
| 4.7–6.3 s | Click the Browser preview to switch the focused window |
| 6.3–9 s | Hold on the Browser with the remaining previews visible |

The animation compresses interaction timing and simplifies the Shell UI. Actual
visuals depend on your theme, settings, and applications. The right-hand strip follows the extension’s default layout. Preview cards exclude the active
window and use a slight mirrored shear and app badges.

## Git LFS

MP4 files in `docs/media/` use Git LFS via the root `.gitattributes`.
Install Git LFS before cloning or updating the video:

```sh
git lfs install --local
git lfs pull
```

After rebuilding, stage the video normally; the LFS clean filter stores its bytes
in LFS and puts a small pointer in Git:

```sh
git add .gitattributes docs/media/stage-manager-demo.mp4
git lfs status
git show :docs/media/stage-manager-demo.mp4
```

The last command should print a three-line LFS pointer, not binary video data.
The root README embeds the video with an HTML `<video>` element using GitHub’s
LFS media URL. That URL becomes available after pushing the video and LFS object
to `main`. Markdown viewers must support HTML video elements for inline playback.
GitHub’s README renderer requires a GitHub-uploaded video attachment for inline
playback; replace the embed with its attachment URL when publishing there.
A Git push with the LFS hook uploads the video; no separate hosting service is
needed for viewers that support HTML video.
