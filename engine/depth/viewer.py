# Blender GUI startup for a saved SYSTM Depth scene: rendered/material view, an oblique
# 3D view next to the camera view, and the timeline with one marker per beat.
import bpy


def setup():
    win = bpy.context.window
    if not win: return 0.5
    scr = win.screen
    sc = bpy.context.scene
    areas = {a.type: a for a in scr.areas}
    # a timeline at the bottom: turn the biggest non-3D area into one if missing
    if 'DOPESEQUENCE' not in areas and 'TIMELINE' not in areas:
        cand = [a for a in scr.areas if a.type not in ('VIEW_3D',)]
        if cand:
            a = min(cand, key=lambda a: a.height)
            a.type = 'DOPESHEET_EDITOR'
            try: a.ui_type = 'TIMELINE'
            except Exception: pass
    v3d = [a for a in scr.areas if a.type == 'VIEW_3D']
    if v3d:
        big = max(v3d, key=lambda a: a.width * a.height)
        # split: left = free oblique view of the layers in depth, right = through the camera
        with bpy.context.temp_override(window=win, area=big, region=[r for r in big.regions if r.type == 'WINDOW'][0]):
            try: bpy.ops.screen.area_split(direction='VERTICAL', factor=0.58)
            except Exception: pass
        v3d = [a for a in scr.areas if a.type == 'VIEW_3D']
        v3d.sort(key=lambda a: a.x)
        for i, a in enumerate(v3d):
            sp = a.spaces.active
            sp.shading.type = 'MATERIAL'
            sp.overlay.show_relationship_lines = False
            sp.clip_end = 400
            r3 = sp.region_3d
            if i == len(v3d) - 1 and len(v3d) > 1:
                r3.view_perspective = 'CAMERA'
                sp.lock_camera = False
            else:
                # three-quarter view from the side, so the planes read as layers in depth
                from mathutils import Euler, Vector
                r3.view_perspective = 'PERSP'
                r3.view_rotation = Euler((0.22, 0.95, 0)).to_quaternion()
                r3.view_location = Vector((0, 0, -14))
                r3.view_distance = 46
    for a in scr.areas:
        if a.type == 'DOPESHEET_EDITOR':
            try:
                a.spaces.active.show_markers = True
            except Exception: pass
            with bpy.context.temp_override(window=win, area=a, region=[r for r in a.regions if r.type == 'WINDOW'][0]):
                try: bpy.ops.action.view_all()
                except Exception: pass
    sc.render.fps = sc.render.fps
    return None


bpy.app.timers.register(setup, first_interval=1.0)
