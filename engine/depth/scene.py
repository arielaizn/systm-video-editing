# SYSTM Depth: builds the 3D scene from scene.json in Blender and renders it with Eevee.
#   blender -b --factory-startup -noaudio -P scene.py -- scene.json --out DIR [--pass world|front|presenter|text]
#           [--stills f1,f2] [--start f] [--end f] [--save file.blend --frame f --no-render]
#
# The world is real 3D: every painted layer is an emission plane at its own depth in front of a camera that looks
# down -Z, and the camera travels through them (parallax), with real depth of field and motion blur.
# Rendering is split in four passes, composited in that order by depth.mjs finish:
#   world      the sets (bg, mid, hero, card, title in space), camera DOF, opaque
#   presenter  the cut-out speaker, screen-locked, sharp
#   front      foreground layers that pass in front of the speaker (DOF, transparent)
#   text       captions, screen titles, flashes and the Ice line, sharp, transparent
# The .blend saved with --save holds everything in one file, one collection per beat, to look at in Blender.
#
# Motion grammar (from a frame-by-frame study of the reference reels, research/depth-refs/):
#   - the camera never stops: linear drift inside a beat, 2-5% scale per second
#   - cuts carry momentum: ease-in into the cut, ease-out after it (push, whip, dive); the new shot lands
#     too close or offset and defocused, then settles and racks into focus over 6-9 frames
#   - entrances are blurred and eased (scale from 65%, rise, 6-8 frames), no overshoot
#   - the speaker re-enters by rising from the bottom over 6 frames, and carries the whip's momentum
import bpy, json, math, os, sys

argv = sys.argv[sys.argv.index('--') + 1:]
S = json.load(open(argv[0]))
def arg(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d
OUT = arg('--out'); PASS = arg('--pass', 'all')
FPS = S['fps']; W = S['width']; H = S['height']; ASPECT = W / H
LENS = S['lens']; SENSOR = S['sensor']; NF = S['frames']
def hh(d):  # half the frame height in world units at distance d
    return d * (SENSOR / 2) / LENS

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(t): t = clamp(t); return 1 - (1 - t) ** 3
def ease_in(t): t = clamp(t); return t ** 3
def ease_in2(t): t = clamp(t); return t * t
def lerp(a, b, t): return a + (b - a) * t

# ---------- scene ----------
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.name = 'SYSTM Depth'
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.render.resolution_percentage = 50 if S['preview'] else 100
sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = NF
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.eevee.taa_render_samples = 8 if S['preview'] else 12
sc.eevee.bokeh_max_size = 60 if S['preview'] else 120
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.6
try: sc.render.motion_blur_position = 'START'
except Exception: pass
sc.eevee.motion_blur_steps = 1
sc.render.film_transparent = PASS in ('front', 'presenter', 'text')
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA' if sc.render.film_transparent else 'RGB'
sc.render.image_settings.color_depth = '8'
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
bgn = world.node_tree.nodes.get('Background')
if bgn: bgn.inputs[0].default_value = (0.0025, 0.0037, 0.0043, 1)
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'

cam_data = bpy.data.cameras.new('camera'); cam_data.lens = LENS; cam_data.sensor_fit = 'VERTICAL'; cam_data.sensor_height = SENSOR
cam_data.clip_start = 0.05; cam_data.clip_end = 500
cam_data.dof.use_dof = PASS in ('world', 'front', 'all')
cam = bpy.data.objects.new('camera', cam_data); sc.collection.objects.link(cam); sc.camera = cam

mesh = bpy.data.meshes.new('unit')
mesh.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0)], [], [(0, 1, 2, 3)])
uv = mesh.uv_layers.new(name='UVMap')
for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uv.data[i].uv = c
mesh.update()

ROOT = {}
for n in ('World', 'Front', 'Presenter', 'Text'):
    c = bpy.data.collections.new(n); sc.collection.children.link(c); ROOT[n] = c
SUB = {}
def collection(group, sub=None):
    if not sub: return ROOT[group]
    if (group, sub) not in SUB:
        c = bpy.data.collections.new(sub); ROOT[group].children.link(c); SUB[(group, sub)] = c
    return SUB[(group, sub)]

IMAGES = {}
def load(path, source='FILE'):
    if (path, source) not in IMAGES:
        img = bpy.data.images.load(path, check_existing=False)
        if source != 'FILE': img.source = source
        img.alpha_mode = 'STRAIGHT'; IMAGES[(path, source)] = img
    return IMAGES[(path, source)]

def material(name, img=None, gain=1.0, method='DITHERED', alpha_img=None, alpha_ramp=None, solid=None, movie_frames=0, seq_frames=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.surface_render_method = method
    N = m.node_tree.nodes; L = m.node_tree.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission'); tr = N.new('ShaderNodeBsdfTransparent'); mix = N.new('ShaderNodeMixShader')
    info = N.new('ShaderNodeObjectInfo'); mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    em.inputs['Strength'].default_value = gain
    if solid is not None:
        em.inputs['Color'].default_value = solid; mul.inputs[0].default_value = 1.0
    else:
        tex = N.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Cubic'; tex.extension = 'CLIP'
        if movie_frames:
            tex.image_user.frame_duration = movie_frames; tex.image_user.frame_start = 1; tex.image_user.frame_offset = 0; tex.image_user.use_auto_refresh = True
        L.new(tex.outputs['Color'], em.inputs['Color'])
        if alpha_img is not None:
            at = N.new('ShaderNodeTexImage'); at.image = alpha_img; at.interpolation = 'Linear'; at.extension = 'EXTEND'
            at.image_user.frame_duration = seq_frames; at.image_user.frame_start = 1; at.image_user.frame_offset = 0; at.image_user.use_auto_refresh = True
            rng = N.new('ShaderNodeMapRange'); rng.inputs['From Min'].default_value = alpha_ramp[0]; rng.inputs['From Max'].default_value = alpha_ramp[1]
            L.new(at.outputs['Color'], rng.inputs['Value']); L.new(rng.outputs['Result'], mul.inputs[0])
        elif movie_frames: mul.inputs[0].default_value = 1.0
        else: L.new(tex.outputs['Alpha'], mul.inputs[0])
    L.new(info.outputs['Alpha'], mul.inputs[1]); L.new(mul.outputs[0], mix.inputs['Fac'])
    L.new(tr.outputs[0], mix.inputs[1]); L.new(em.outputs[0], mix.inputs[2]); L.new(mix.outputs[0], out.inputs['Surface'])
    return m

def plane(name, mat, coll, parent=None):
    o = bpy.data.objects.new(name, mesh.copy()); o.data.materials.append(mat)
    coll.objects.link(o)
    if parent: o.parent = parent
    o.color = (1, 1, 1, 1)
    return o

def vis(o, f, hidden):
    o.hide_render = hidden; o.hide_viewport = hidden
    o.keyframe_insert('hide_render', frame=f); o.keyframe_insert('hide_viewport', frame=f)
def show_only(o, f0, f1):
    if f0 > 1: vis(o, 1, True)
    vis(o, f0, False)
    if f1 < NF: vis(o, f1 + 1, True)

def key(o, f, loc=None, rot=None, scale=None, alpha=None):
    if loc is not None: o.location = loc; o.keyframe_insert('location', frame=f)
    if rot is not None: o.rotation_euler = rot; o.keyframe_insert('rotation_euler', frame=f)
    if scale is not None: o.scale = scale; o.keyframe_insert('scale', frame=f)
    if alpha is not None: o.color = (1, 1, 1, alpha); o.keyframe_insert('color', index=3, frame=f)

# ---------- entrances and exits (dx, dy in layer widths/heights), from the references ----------
ENTRY = {'pop': 8, 'rise': 7, 'drop': 6, 'slide-left': 10, 'slide-right': 10, 'flip': 8, 'zoom': 8, 'fade': 8}
def entry(anim, f, at):
    if anim == 'none': return 0, 0, 1, 0, 1
    u = (f - at) / float(ENTRY.get(anim, 8)); a = clamp(u * 1.8); e = ease_out(u)
    if anim == 'pop':   return 0, -0.06 * (1 - e), 0.65 + 0.35 * e, 0, a          # blur-scale in, no overshoot
    if anim == 'rise':  return 0, -0.9 * (1 - e), 1, 0, a
    if anim == 'drop':  return 0, 1.6 * (1 - e), 1, 0, clamp(u * 4)
    if anim == 'slide-left':  return 1.2 * (1 - e), 0, 1, 0, a
    if anim == 'slide-right': return -1.2 * (1 - e), 0, 1, 0, a
    if anim == 'flip':  return 0.35 * (1 - e), 0, 1, math.radians(88) * (1 - e), clamp(u * 3)  # from edge-on
    if anim == 'zoom':  return 0, 0, 1.35 - 0.35 * e, 0, e
    return 0, 0, 1, 0, e
def exit_(anim, f, out):
    v = ease_in2((f - out) / 4.0)
    if anim == 'slide-left': return -1.4 * v, 0, 1, 0, 1 - v * 0.3
    if anim == 'slide-right': return 1.4 * v, 0, 1, 0, 1 - v * 0.3
    return 0, 1.8 * v, 1, 0, 1 - v * 0.3

# ---------- camera: drift inside the beat + momentum across cuts ----------
DIRS = {'whip': (-1, 0), 'whip-left': (-1, 0), 'whip-right': (1, 0), 'whip-up': (0, 1), 'whip-down': (0, -1)}
cam_pose, base_z, focus, fstop, flash, pres_off = {}, {}, {}, {}, {}, {}
for bi, b in enumerate(S['beats']):
    f0, f1, foc, A = b['f0'], b['f1'], b['focus'], b['camera']['amount']
    mv = b['camera']['move']; tin = b['transition']; tout = b['next']
    fw = 2 * hh(foc) * ASPECT; fh = 2 * hh(foc)
    T = (f1 - f0) / FPS
    prev = S['beats'][bi - 1]['presenter'] if bi else 'none'
    for f in range(f0, f1 + 1):
        s = (f - f0) / FPS
        x = y = z = ry = rz = 0.0
        if mv == 'push': z = -A * 0.035 * foc * s
        elif mv == 'pull': z = -A * 0.035 * foc * (T - s)
        elif mv == 'dolly': z = -A * 0.07 * foc * s
        elif mv == 'truck-left': x = -A * 0.045 * foc * (s - T / 2)
        elif mv == 'truck-right': x = A * 0.045 * foc * (s - T / 2)
        elif mv == 'rise': y = A * 0.035 * foc * (s - T / 2)
        elif mv == 'fall': y = -A * 0.035 * foc * (s - T / 2)
        elif mv == 'orbit':
            a = math.radians(3.0 * A) * (s - T / 2)
            x = math.sin(a) * foc; z = foc * (1 - math.cos(a)); ry = a
        elif mv == 'roll': z = -A * 0.03 * foc * s; rz = math.radians(2.5 * A) * (s - T / 2)
        else: z = -0.012 * foc * s
        base_z[f] = z
        fs = b['fstop']
        u = f - f0; v = f - f1
        if tin == 'push':
            k = 1 - ease_out(u / 9.0); z -= 0.42 * foc * k; fs = lerp(fs, 0.3, k)
        elif tin in DIRS:
            dx, dy = DIRS[tin]; k = 1 - ease_out(u / 7.0); x -= dx * 0.55 * fw * k; y -= dy * 0.55 * fh * k
        elif tin == 'dive':
            k = 1 - ease_out(u / 10.0); z += 0.3 * foc * k; fs = lerp(fs, 0.4, k)
        elif tin in ('flash', 'dip'):
            k = 1 - ease_out(u / 8.0); z -= 0.25 * foc * k; fs = lerp(fs, 0.35, k)
        if tout == 'push' and v > -5: z -= 0.5 * foc * ease_in(1 + v / 5.0)
        elif tout in DIRS and v > -6:
            dx, dy = DIRS[tout]; k = ease_in(1 + v / 6.0); x -= dx * 0.6 * fw * k; y -= dy * 0.6 * fh * k
        elif tout == 'dive' and v > -9: z -= 0.95 * foc * ease_in(1 + v / 9.0)
        elif tout in ('flash', 'dip') and v > -5: z -= 0.3 * foc * ease_in(1 + v / 5.0)
        cam_pose[f] = (x, y, z, ry, rz)
        focus[f] = max(0.3, foc + z); fstop[f] = fs
        fl = 0.0; col = 'white' if 'flash' in (tin, tout) or tin == 'dive' else 'black'
        if tin in ('flash', 'dip') and u < 4: fl = [1, 0.75, 0.4, 0.15][u]
        if tin == 'dive' and u < 6: fl = [0.85, 0.7, 0.5, 0.3, 0.15, 0.05][u]
        if tout in ('flash', 'dip'): fl = max(fl, {0: 0.6, -1: 0.25}.get(v, 0))
        flash[f] = (fl, col)
        px = py = 0.0
        if tin in DIRS and prev == 'bottom':
            dx, dy = DIRS[tin]; k = 1 - ease_out(u / 7.0); px -= dx * 0.22 * k; py -= dy * 0.22 * k
        elif prev != 'bottom' or tin in ('push', 'flash', 'dip', 'dive'):
            k = 1 - ease_out(u / 7.0); py -= 0.45 * k
        if tout in DIRS and v > -6:
            dx, dy = DIRS[tout]; k = ease_in(1 + v / 6.0); px += dx * 0.9 * k; py += dy * 0.9 * k
        pres_off[f] = (px, py)

for f, (x, y, z, ry, rz) in cam_pose.items():
    key(cam, f, loc=(x, y, z), rot=(0, ry, rz))
    cam_data.dof.focus_distance = focus[f]; cam_data.dof.keyframe_insert('focus_distance', frame=f)
    cam_data.dof.aperture_fstop = fstop[f]; cam_data.dof.keyframe_insert('aperture_fstop', frame=f)

# ---------- the sets ----------
for b in S['beats']:
    f0, f1 = b['f0'], b['f1']
    label = '%s  %.1f-%.1fs  %s' % (b['id'], (f0 - 1) / FPS, f1 / FPS, b.get('label', ''))
    for l in b['layers']:
        img = load(l['file']); iw, ih = img.size; asp = iw / max(1, ih)
        coll = collection('Front', label) if l.get('front') else collection('World', label)
        o = plane(l['id'], material(l['id'], img, l['gain']), coll)
        z = l['z']; h = hh(z)
        if l['role'] == 'bg':
            ph = 2 * h * 1.55; pw = ph * asp
            if pw < 2 * h * ASPECT * 1.55: pw = 2 * h * ASPECT * 1.55; ph = pw / asp
        else:
            ph = l['h'] * 2 * h; pw = ph * asp
        bx, by = l['x'] * h * ASPECT, l['y'] * h
        anim = l['anim']; at = l['at'] if anim != 'none' else f0
        show_only(o, max(f0, at), (l['out'] + 4) if l['out'] else f1)
        phase = (sum(map(ord, l['id'])) % 100) / 100 * 6.28
        for f in range(max(f0, at) - 1, f1 + 2):
            dx, dy, s, ry, a = entry(anim, f, at) if f < at + ENTRY.get(anim, 8) else (0, 0, 1, 0, 1)
            if l['out'] and f >= l['out']: dx, dy, s, ry, a = exit_(anim, f, l['out'])
            t = f / FPS
            fy = math.sin(t * 2 * math.pi / 3.6 + phase) * 0.015 * ph if l['float'] else 0
            rz = math.radians(1.0) * math.sin(t * 2 * math.pi / 4.4 + phase) if l['float'] else 0
            spin = math.radians(l['spin']) * (f - f0) / FPS
            zf = (cam_pose[f][2] * 0.85 if (l['role'] == 'fg' and f in cam_pose) else 0) - z   # fg keeps its distance in depth (else the momentum push flies through it)
            key(o, f, loc=(bx + dx * pw, by + dy * ph + fy, zf), rot=(math.radians(l['tilt']), ry + spin, rz + math.radians(l.get('roll', 0))), scale=(pw * s, ph * s, 1), alpha=a)
    t = b['title']
    if t and t['space'] == 'world':   # title in space: builds word by word, leaves with the set
        z = t['z']; adv = max(0.0, -min(base_z[f] for f in range(f0, f1 + 1)))
        h = hh(max(1.0, z - adv)); k = 2 * h / H
        coll = collection('World', label)
        for si, st in enumerate(t['states']):
            pw, ph = st['w'] * k, st['h'] * k; y = (1 - 2 * t['y']) * h - ph / 2
            name = 'title-%s-%d' % (b['id'], si + 1)
            o = plane(name, material(name, load(st['file'])), coll)
            end = f1 if si == len(t['states']) - 1 else t['states'][si + 1]['f'] + 2
            show_only(o, st['f'], end)
            for f in range(st['f'] - 1, end + 2):
                u = (f - st['f']) / (7.0 if si == 0 else 3.0)
                rise = 0.08 * ph * (1 - ease_out(u)) if si == 0 else 0
                g = (0.94 + 0.06 * ease_out(u)) if si == 0 else 1
                key(o, f, loc=(0, y - rise, -z), scale=(pw * g, ph * g, 1), alpha=ease_out(u))

# ---------- screen-locked: parented to the camera ----------
DP = 1.6
if any(b['presenter'] != 'none' for b in S['beats']):
    movie = load(S['src'], 'MOVIE'); h = hh(DP); fr = S['presenter']; pc = collection('Presenter')
    if S['matteCount']:
        seq = load(os.path.join(S['matteDir'], '00001.png'), 'SEQUENCE'); seq.colorspace_settings.name = 'Non-Color'
        pm = material('presenter', movie, 1.0, 'BLENDED', alpha_img=seq, alpha_ramp=(0.2, 0.9), movie_frames=NF, seq_frames=S['matteCount'])
        pb = plane('presenter', pm, pc, cam); vis(pb, 1, True)
        for b in S['beats']:
            s = fr['s'] * b['zoom']; ph = 2 * h * s; pw = ph * ASPECT
            yc = h * (1 - 2 * fr['T']) - ph * (0.5 - fr['t']); xc = (0.5 - fr['cx']) * pw
            for f in range(b['f0'], b['f1'] + 1):
                px, py = pres_off[f]
                key(pb, f, loc=(xc + px * 2 * h * ASPECT, yc + py * 2 * h, -DP), scale=(pw, ph, 1))
            vis(pb, b['f0'], b['presenter'] != 'bottom')
    full = plane('presenter-full', material('presenter-full', movie, 1.0, 'BLENDED', movie_frames=NF), pc, cam); vis(full, 1, True)
    for b in S['beats']:
        ph = 2 * hh(DP + 0.2) * b['zoom']
        for f in range(b['f0'], b['f1'] + 1):
            g = 1 + 0.012 * (f - b['f0']) / FPS
            key(full, f, loc=(0, 0, -(DP + 0.2)), scale=(ph * ASPECT * g, ph * g, 1))
        vis(full, b['f0'], b['presenter'] != 'full')

tc = collection('Text'); DT = 1.2; h = hh(DT); k = 2 * h / H
for b in S['beats']:
    t = b['title']
    if not t or t['space'] != 'screen': continue
    for si, st in enumerate(t['states']):
        pw, ph = st['w'] * k, st['h'] * k; y = (1 - 2 * t['y']) * h - ph / 2
        name = 'stitle-%s-%d' % (b['id'], si + 1)
        o = plane(name, material(name, load(st['file']), 1.0, 'BLENDED'), tc, cam)
        end = b['f1'] if si == len(t['states']) - 1 else t['states'][si + 1]['f'] + 2
        show_only(o, st['f'], end)
        for f in range(st['f'] - 1, end + 2):
            u = (f - st['f']) / (7.0 if si == 0 else 3.0)
            key(o, f, loc=(0, y - (0.1 * ph * (1 - ease_out(u)) if si == 0 else 0), -DT), scale=(pw, ph, 1), alpha=ease_out(u))
for c in S['captions']:            # captions build word by word
    for si, st in enumerate(c['states']):
        pw, ph = st['w'] * k, st['h'] * k; y = (1 - 2 * S['captionY']) * h
        name = os.path.basename(st['file'])[:-4]
        o = plane(name, material(name, load(st['file']), 1.0, 'BLENDED'), tc, cam)
        end = c['f1'] if si == len(c['states']) - 1 else c['states'][si + 1]['f']
        show_only(o, st['f'], end)
        for f in range(st['f'] - 1, min(st['f'] + 4, end + 1)):
            u = (f - st['f']) / 3.0
            key(o, f, loc=(0, y - (6 * k * (1 - ease_out(u)) if si == 0 else 0), -DT), scale=(pw, ph, 1), alpha=ease_out(u) if si == 0 else 1)
if any(v[0] > 0 for v in flash.values()):
    hf = hh(1.1)
    for col, rgb in (('white', (0.96, 0.97, 0.97, 1)), ('black', (0.0, 0.0, 0.0, 1))):
        vals = {f: v[0] for f, v in flash.items() if v[1] == col}
        if not any(vals.values()): continue
        o = plane('flash-' + col, material('flash-' + col, None, 1.0, 'BLENDED', solid=rgb), tc, cam)
        for f in range(1, NF + 1):
            key(o, f, loc=(0, 0, -1.1), scale=(2 * hf * ASPECT * 1.05, 2 * hf * 1.05, 1), alpha=vals.get(f, 0))
line_beats = [b for b in S['beats'] if b['transition'] == 'line']
if line_beats:
    DL = 1.25; hl = hh(DL); thick = 5 * 2 * hl / H; full_w = 2 * hl * ASPECT
    o = plane('ice-line', material('line', None, 1.6, 'BLENDED', solid=(0.674, 0.957, 0.973, 1)), tc, cam); vis(o, 1, True)
    for b in line_beats:
        c0 = b['f0']
        for f in range(c0 - 8, c0 + 9):
            if f < c0: u = ease_out((f - (c0 - 8)) / 8); wdt = full_w * u; x = full_w / 2 - wdt / 2
            else: u = ease_in((f - c0) / 8); wdt = full_w * (1 - u); x = -full_w / 2 + wdt / 2
            key(o, f, loc=(x, 0.0, -DL), scale=(max(wdt, 1e-4), thick, 1), alpha=1)
        vis(o, c0 - 8, False); vis(o, c0 + 9, True)

# timeline markers: one per beat, so the timeline reads like the plan
for b in S['beats']:
    m = sc.timeline_markers.new('%s %s' % (b['id'], b.get('label', '')), frame=b['f0'])

if PASS != 'all':
    want = {'world': 'World', 'front': 'Front', 'presenter': 'Presenter', 'text': 'Text'}[PASS]
    for lc in sc.view_layers[0].layer_collection.children: lc.exclude = lc.name != want

if arg('--save'):
    sc.frame_set(int(arg('--frame', 1)))
    bpy.ops.wm.save_as_mainfile(filepath=arg('--save'))
    print('depth: saved ' + arg('--save'), flush=True)
if '--no-render' in argv: sys.exit(0)

stills = arg('--stills')
if stills:
    for f in [int(x) for x in stills.split(',')]:
        sc.frame_set(f); sc.render.filepath = os.path.join(OUT, '%05d.png' % f)
        bpy.ops.render.render(write_still=True)
    print('depth: stills done', flush=True)
else:
    sc.frame_start = int(arg('--start', 1)); sc.frame_end = int(arg('--end', NF))
    sc.render.filepath = os.path.join(OUT, '#####')
    bpy.ops.render.render(animation=True)
    print('depth: rendered %s %d-%d' % (PASS, sc.frame_start, sc.frame_end), flush=True)
