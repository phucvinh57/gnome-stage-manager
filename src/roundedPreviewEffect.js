import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

const DECLARATIONS = `
uniform vec2 preview_size;
uniform float preview_radius;
`;

// Clutter enlarges integer, actor-local paint bounds by three logical pixels:
// two before the origin and one after the far edge. The surface has integer
// dimensions and a clipped child, so its offscreen always has these bounds.
// Map the padded texture back to actor coordinates before masking it. Treating
// the entire texture as preview_size leaves the bottom/right edges unmasked.
// Run on the unclipped surface so its child's hard crop cannot cut off the AA.
const CODE = `
vec2 p = cogl_tex_coord_in[0].st * (preview_size + vec2(3.0)) - vec2(2.0);
vec2 q = abs(p - preview_size * 0.5) - (preview_size * 0.5 - preview_radius);
float distance = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - preview_radius;
// Evaluate coverage in screen pixels, after shear and monitor scaling. Keep
// the ramp inside the crop: there is no source content outside its boundary.
float aa = max(fwidth(distance), 0.0001);
cogl_color_out *= 1.0 - smoothstep(-aa, 0.0, distance);
`;

// Shell 51 moved the effect and changed both snippet and uniform APIs.
const modern = !Shell.GLSLEffect;
const Effect = modern ? Clutter.ShaderEffect : Shell.GLSLEffect;

export const RoundedPreviewEffect = GObject.registerClass(
class RoundedPreviewEffect extends Effect {
    [modern ? 'vfunc_get_static_snippet' : 'vfunc_build_pipeline']() {
        if (modern)
            return Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, CODE);
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
    }

    update(width, height, radius) {
        radius = Math.max(0, Math.min(radius, width / 2, height / 2));
        // Square previews need the same transparent edge for the shear.
        if (modern) {
            // GJS infers the array length; only the component count is explicit.
            this.set_uniform_float('preview_size', 2, [width, height]);
            this.set_uniform_float('preview_radius', 1, [radius]);
        } else {
            this.set_uniform_float(this.get_uniform_location('preview_size'), 2, [width, height]);
            this.set_uniform_float(this.get_uniform_location('preview_radius'), 1, [radius]);
        }
        this.queue_repaint();
    }
});
