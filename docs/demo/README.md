# Remotion demo

This project renders the animated walkthrough embedded in the root README.
It illustrates the extension’s behavior with drawn application windows; it is
not a GNOME session recording or a runtime compatibility test.

## Output

- README preview: [`../media/stage-manager-demo.gif`](../media/stage-manager-demo.gif)
- Composition: `StageManager`, 1920 × 1080, 30 fps, 270 frames (9 seconds)
- Preview format: looping GIF, 960 × 540, 12 fps, with on-screen explanations
- Intermediate render: silent H.264 MP4 in the ignored `build/` directory

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

The render command creates `docs/demo/build/stage-manager-demo.mp4` as a local
intermediate file. Generate the README preview with FFmpeg:

```sh
ffmpeg -y -i docs/demo/build/stage-manager-demo.mp4 \
  -filter_complex '[0:v]fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' \
  -loop 0 docs/media/stage-manager-demo.gif
```

Run this command from the repository root. Only the GIF is published; the
intermediate MP4 can be deleted after conversion.

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

## Publishing the preview

The root README displays the GIF as a standard Markdown image. Commit
`docs/media/stage-manager-demo.gif` in regular Git so the inline preview does not
depend on LFS media hosting. The intermediate MP4 is ignored and is not needed
to view the demo.
