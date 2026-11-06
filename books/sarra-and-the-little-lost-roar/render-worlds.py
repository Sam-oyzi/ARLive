"""Render Sarra's spherical illustrations with Blender 4.5 and Cycles.

    blender -b -t 12 --python-exit-code 1 --python render-worlds.py -- --output assets

The camera sees the same geometry in all directions. It is 1.5 m above the
bank, level, and turns toward each scene's subject. Blender +Y maps to the
viewer's forward (-Z), and image-right is world-right at the starting view.
"""
import argparse
import math
from pathlib import Path
import random
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.noise import noise_vector


BOOK = Path(__file__).resolve().parent
WORLDS = {
    "forest": (21, (-5.3, -0.3), -10, False),
    "owl": (40, (-4.9, -0.5), -3, False),
    "brook": (57, (-3.2, -1.1), -40, False),
    "bridge": (57, (-3.8, -0.6), -70, False),
    "river": (57, (-4.4, -4.0), -27, True),
}


def rgb(color):
    srgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*(c / 12.92 if c < 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb), 1)


def material(name, color, detail=None, scale=4, roughness=0.9):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgb(color)
    shader.inputs["Roughness"].default_value = roughness
    if detail:
        coords = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        noise.inputs["Detail"].default_value = 4
        links.new(coords.outputs["Object"], noise.inputs["Vector"])
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.22
        ramp.color_ramp.elements[0].color = rgb(detail)
        ramp.color_ramp.elements[1].position = 0.78
        ramp.color_ramp.elements[1].color = rgb(color)
        links.new(noise.outputs["Fac"], ramp.inputs[0])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.24
        bump.inputs["Distance"].default_value = 0.075
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return mat


def make_ico():
    mesh = bmesh.new()
    bmesh.ops.create_icosphere(mesh, subdivisions=2, radius=1)
    mesh.verts.index_update()
    shape = ([tuple(v.co) for v in mesh.verts], [tuple(v.index for v in f.verts) for f in mesh.faces])
    mesh.free()
    return shape


ICO = make_ico()


class Geometry:
    """Combine thousands of pieces into a few meshes without a Blender object per leaf."""

    def __init__(self, name, materials, smooth=False):
        self.name, self.materials, self.smooth = name, materials, smooth
        self.vertices, self.faces, self.slots = [], [], []

    def add(self, vertices, faces, slot=0):
        start = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(start + i for i in face) for face in faces)
        self.slots.extend([slot] * len(faces))

    def oval(self, p, size, slot=0):
        vertices, faces = ICO
        self.add([tuple(p[i] + size[i] * v[i] for i in range(3)) for v in vertices], faces, slot)

    def branch(self, points, radii, slot=0, sides=7):
        vertices = []
        for i, p in enumerate(points):
            axis = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
            u = axis.cross(Vector((0, 1, 0))).normalized()
            if u.length < 0.01:
                u = axis.cross(Vector((1, 0, 0))).normalized()
            v = axis.cross(u)
            vertices.extend(Vector(p) + radii[i] * (math.cos(a) * u + math.sin(a) * v)
                            for a in (2 * math.pi * k / sides for k in range(sides)))
        faces = [tuple(reversed(range(sides))), tuple(range(len(vertices) - sides, len(vertices)))]
        for j in range(len(points) - 1):
            for i in range(sides):
                a, b = j * sides + i, j * sides + (i + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        self.add(vertices, faces, slot)

    def finish(self):
        if not self.faces:
            return
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.vertices, [], self.faces)
        for mat in self.materials:
            mesh.materials.append(mat)
        mesh.polygons.foreach_set("material_index", self.slots)
        if self.smooth:
            mesh.polygons.foreach_set("use_smooth", [True] * len(self.faces))
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def river_center(y):
    return 0.63 * math.sin(y * 0.23) + 0.29 * math.sin(y * 0.54)


def path_center(y):
    return -4.8 + 0.48 * math.sin(y * 0.26)


def terrain(x, y):
    distance = abs(x - river_center(y))
    bank = min(1, max(0, (distance - 0.85) / 0.8))
    rolling = 0.20 * math.sin(0.27 * x + 0.2 * y) + 0.12 * math.cos(0.31 * y - x)
    rises = 0.74 * math.exp(-((x + 13) ** 2 + (y - 12) ** 2) / 75)
    return -0.43 + bank * (0.43 + rolling + rises) + 0.047 * noise_vector((x * 1.1, y * 1.1, 0))[0]


def make_land():
    earth = material("Moss and ochre earth", "9c975a", "515934", 2.7)
    nodes, links = earth.node_tree.nodes, earth.node_tree.links
    shader = nodes.get("Principled BSDF")
    coords = nodes.get("Texture Coordinate")
    position = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords.outputs["Object"], position.inputs[0])

    def math_node(op, first, second=0):
        node = nodes.new("ShaderNodeMath")
        node.operation = op
        for index, source in enumerate((first, second)):
            if isinstance(source, (float, int)):
                node.inputs[index].default_value = source
            else:
                links.new(source, node.inputs[index])
        return node.outputs[0]

    # A soft, continuous dirt trail follows the same curve used to place trees and grass.
    y_angle = math_node("MULTIPLY", position.outputs["Y"], 0.26)
    center = math_node("MULTIPLY_ADD", math_node("SINE", y_angle), 0.48)
    center.node.inputs[2].default_value = -4.8
    distance = math_node("ABSOLUTE", math_node("SUBTRACT", position.outputs["X"], center))
    noise = nodes.get("Noise Texture")
    wobbly_edge = math_node("ADD", distance, math_node("MULTIPLY", noise.outputs["Fac"], 0.26))
    mask = nodes.new("ShaderNodeMapRange")
    mask.interpolation_type = "SMOOTHSTEP"
    links.new(wobbly_edge, mask.inputs["Value"])
    mask.inputs["From Min"].default_value, mask.inputs["From Max"].default_value = 0.68, 0.93
    mask.inputs["To Min"].default_value, mask.inputs["To Max"].default_value = 1, 0
    dirt = nodes.new("ShaderNodeValToRGB")
    dirt.color_ramp.elements[0].color, dirt.color_ramp.elements[1].color = rgb("806749"), rgb("c6a781")
    links.new(noise.outputs["Fac"], dirt.inputs[0])
    blend = nodes.new("ShaderNodeMixRGB")
    links.new(mask.outputs[0], blend.inputs[0])
    links.new(shader.inputs["Base Color"].links[0].from_socket, blend.inputs[1])
    links.new(dirt.outputs[0], blend.inputs[2])
    links.new(blend.outputs[0], shader.inputs["Base Color"])
    bed = material("Shallow brook bed", "5e6654", "342e20", 4.5)
    ground = Geometry("Valley and footpath", [earth, bed], smooth=True)
    step, span = 0.32, 251
    points = [(step * (i - span // 2), step * (j - span // 2)) for j in range(span) for i in range(span)]
    ground.vertices = [(x, y, terrain(x, y)) for x, y in points]
    for j in range(span - 1):
        for i in range(span - 1):
            a = j * span + i
            x, y = points[a]
            x, y = x + step / 2, y + step / 2
            ground.faces.append((a, a + 1, a + span + 1, a + span))
            ground.slots.append(int(abs(x - river_center(y)) < 1.08))
    ground.finish()

    water = material("Shallow blue-green water", "46777a", "32595a", 2.1, roughness=0.17)
    nodes, links = water.node_tree.nodes, water.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Transmission Weight"].default_value = 0.46
    bsdf.inputs["IOR"].default_value = 1.333
    wave = nodes.new("ShaderNodeTexWave")
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 4.6
    wave.inputs["Distortion"].default_value = 6.4
    wave.inputs["Detail Scale"].default_value = 1.5
    coords = nodes.new("ShaderNodeTexCoord")
    links.new(coords.outputs["Object"], wave.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.32
    bump.inputs["Distance"].default_value = 0.034
    links.new(wave.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    stream = Geometry("Brook surface", [water])
    rows = [i * 0.25 for i in range(-155, 156)]
    stream.add([(river_center(y) + side * 1.35, y, -0.21) for y in rows for side in (-1, 1)],
               [(i, i + 1, i + 3, i + 2) for i in range(0, (len(rows) - 1) * 2, 2)])
    stream.finish()


def woodland(rng, key, camera_xy):
    bark = material("Ridged chestnut bark", "795139", "3d2e26", 5)
    branch = Geometry("Woodland trunks and branches", [bark], smooth=True)
    foliage = Geometry("Tree canopies", [
        material("Deep olive leaves", "677c39", "46552b", 8),
        material("Sage leaves", "8b9c55", "596b34", 9),
        material("Honey-green leaves", "adb661", "758645", 7),
        material("Amber leaves", "d0ad58", "8d793b", 8),
    ], smooth=True)
    positions = []
    for _ in range(240):
        x, y = rng.uniform(-31, 31), rng.uniform(-31, 31)
        if abs(x - river_center(y)) < 2.05 or abs(x - path_center(y)) < 1.15:
            continue
        if math.dist((x, y), camera_xy) < 3.3 or any(math.dist((x, y), p) < 2.5 for p in positions):
            continue
        positions.append((x, y))
    if key == "owl":
        positions.append((-5.8, 3.7))
    for x, y in positions:
        z, h = terrain(x, y), rng.uniform(3.8, 7.4)
        r = h * rng.uniform(0.032, 0.059)
        trunk = [(x, y, z - 0.12), (x - r * 0.5, y + r, z + h * 0.36), (x + r, y, z + h * 0.7), (x + r * 1.7, y, z + h)]
        branch.branch(trunk, (r * 1.45, r * 0.84, r * 0.47, r * 0.12), sides=9)
        for k in range(6):
            angle = rng.uniform(-0.4, 0.4) + k * math.tau / 6
            spread = rng.uniform(0.18, 0.36) * h
            start = trunk[1 if k < 3 else 2]
            tip = (x + math.cos(angle) * spread, y + math.sin(angle) * spread, z + h * rng.uniform(0.71, 1.08))
            elbow = ((start[0] + tip[0]) * 0.5, (start[1] + tip[1]) * 0.5, (start[2] + tip[2]) * 0.5 + 0.25)
            branch.branch((start, elbow, tip), (r * 0.55, r * 0.28, r * 0.045))
            for _ in range(16):
                a = tuple(value + rng.uniform(-0.76, 0.76) for value in tip)
                s = rng.uniform(0.23, 0.78)
                foliage.oval(a, (s, s * 0.9, s * 0.7), rng.choices(range(4), (3, 6, 4, 1))[0])
        for k in range(4):
            a = k * math.pi / 2 + rng.uniform(0, 0.55)
            end = (x + math.cos(a) * r * 3.1, y + math.sin(a) * r * 3.1)
            branch.branch(((x, y, z + r * 0.55), (*end, terrain(*end) - 0.04)), (r * 0.63, 0.012))

    if key == "owl":
        branch.branch(((-5.8, 3.7, 2.08), (-5.13, 3.5, 2.35), (-4.55, 3.45, 2.39)), (0.18, 0.1, 0.034))
        make_owl((-4.84, 3.47, 2.43))
    if key in {"bridge", "river"}:
        y = 1.34
        branch.branch(((-1.75, y, 0.07), (-0.75, y - 0.08, 0.23), (0.4, y + 0.09, 0.26), (1.9, y + 0.13, 0.05)),
                      (0.19, 0.17, 0.15, 0.12), sides=11)
        for j in range(24):
            x = -1.55 + j * 0.137
            foliage.oval((x, y + rng.uniform(-0.06, 0.06), 0.29 + 0.1 * math.cos(x)), (0.16, 0.10, 0.033), 0)
    branch.finish()
    foliage.finish()


def make_owl(at):
    mats = [material("Owl " + name, color) for name, color in (
        ("feathers", "795137"), ("chest", "c6a16b"), ("face", "ead4a2"), ("eyes", "251c16"), ("beak", "ce8d35"),
    )]
    owl = Geometry("Owl on the branch", mats, smooth=True)
    x, y, z = at
    owl.oval((x, y, z + 0.23), (0.21, 0.16, 0.24))
    owl.oval((x, y - 0.1, z + 0.22), (0.16, 0.10, 0.18), 1)
    owl.oval((x, y - 0.02, z + 0.45), (0.203, 0.15, 0.16))
    for side in (-1, 1):
        owl.oval((x + side * 0.075, y - 0.14, z + 0.45), (0.105, 0.048, 0.102), 2)
        owl.oval((x + side * 0.075, y - 0.178, z + 0.462), (0.026, 0.023, 0.031), 3)
    owl.oval((x, y - 0.192, z + 0.422), (0.027, 0.025, 0.034), 4)
    owl.finish()


def undergrowth(rng, camera_xy):
    greens = [material("Grass " + str(i), color) for i, color in enumerate(("667e3b", "9d9d52", "849647", "4b6338"))]
    grass = Geometry("Grasses and stream reeds", greens)
    flowers = Geometry("Woodland wildflowers", [material("Warm petal", "f7e8c8"), material("Violet petal", "afa1ce"), material("Golden pollen", "e6b446")])
    stones = Geometry("Rounded stream stones", [material("Sandstone", "a39b84", "666558", 7), material("Mossy stone", "777e54", "4a4d3a", 6)], smooth=True)
    cx, cy = camera_xy
    for _ in range(5300):
        x, y = rng.uniform(cx - 16, cx + 16), rng.uniform(cy - 16, cy + 16)
        d = abs(x - river_center(y))
        if d < 1.22 or abs(x - path_center(y)) < 0.62 or math.dist((x, y), camera_xy) < 0.19:
            continue
        z = terrain(x, y)
        tall = 1.2 < d < 1.7 and rng.random() < 0.52
        for _ in range(rng.randint(3, 6)):
            angle = rng.uniform(0, math.tau)
            h = rng.uniform(0.22, 0.85) if tall else rng.uniform(0.07, 0.31)
            w = rng.uniform(0.008, 0.023)
            px, py = x + rng.uniform(-0.12, 0.12), y + rng.uniform(-0.12, 0.12)
            vx, vy = math.cos(angle), math.sin(angle)
            grass.add([(px - w * vy, py + w * vx, z - 0.012), (px + w * vy, py - w * vx, z - 0.012),
                       (px + h * vx * 0.16, py + h * vy * 0.16, z + h * 0.62),
                       (px + h * vx * 0.48, py + h * vy * 0.48, z + h)], [(0, 1, 2), (0, 2, 3)], rng.randrange(4))
        if math.dist((x, y), camera_xy) < 7 and rng.random() < 0.16:
            height, petal = rng.uniform(0.11, 0.22), rng.randrange(2)
            grass.branch(((x, y, z), (x + 0.02, y, z + height)), (0.009, 0.006), sides=4)
            for j in range(5):
                angle = math.tau * j / 5
                flowers.oval((x + 0.02 + 0.024 * math.cos(angle), y + 0.024 * math.sin(angle), z + height),
                             (0.019, 0.016, 0.008), petal)
            flowers.oval((x + 0.02, y, z + height + 0.003), (0.014, 0.014, 0.009), 2)
    for _ in range(205):
        y = rng.uniform(-17, 25)
        x = river_center(y) + rng.choice((-1, 1)) * rng.uniform(0.65, 1.95)
        if 1.0 < y < 1.7:
            continue
        s = rng.uniform(0.08, 0.46)
        stones.oval((x, y, terrain(x, y) + s * 0.16), (s, s * 0.69, s * 0.48), rng.randrange(2))
    for _ in range(110):
        y = cy + rng.uniform(-7, 11)
        x = path_center(y) + rng.uniform(-0.85, 0.85)
        s = rng.uniform(0.018, 0.06)
        stones.oval((x, y, terrain(x, y) - 0.008), (s, s * 0.85, s * 0.52))
    for _ in range(44):
        x, y = cx + rng.uniform(-8, 8), cy + rng.uniform(-7, 10)
        if abs(x - river_center(y)) < 1.4 or abs(x - path_center(y)) < 0.78 or math.dist((x, y), camera_xy) < 0.65:
            continue
        z = terrain(x, y)
        for i in range(6):
            a, length = i * math.tau / 6 + rng.random() * 0.45, rng.uniform(0.26, 0.52)
            dx, dy = math.cos(a), math.sin(a)
            for j in range(3, 13):
                t = j / 13
                p = Vector((x + t * length * dx, y + t * length * dy, z + length * math.sin(1.75 * t)))
                blade = length * (1.1 - t) * 0.29
                for side in (-1, 1):
                    leaf_tip = p + Vector((blade * (dx - side * dy), blade * (dy + side * dx), blade * 0.21))
                    grass.add((p, leaf_tip, p + Vector((dx, dy, 0.12)) * length * 0.075), ((0, 1, 2),), 2)
    grass.finish()
    flowers.finish()
    stones.finish()


def add_character(name, x, y, height, camera_xy, ground=None):
    bpy.ops.import_scene.gltf(filepath=str(BOOK / "assets" / (name + ".glb")))
    imported = list(bpy.context.selected_objects)
    for obj in imported:
        obj.animation_data_clear()
    roots = [obj for obj in imported if obj.parent not in imported]
    anchor = bpy.data.objects.new(name.title() + " placement", None)
    bpy.context.collection.objects.link(anchor)
    for obj in roots:
        obj.parent = anchor
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(p) for obj in imported if obj.type == "MESH" for p in obj.bound_box]
    lo, hi = min(p.z for p in points), max(p.z for p in points)
    scale = height / (hi - lo)
    anchor.scale = (scale,) * 3
    # The existing GLBs face Blender -Y after glTF import.
    anchor.rotation_euler.z = math.atan2(camera_xy[0] - x, y - camera_xy[1])
    anchor.location = (x, y, (terrain(x, y) if ground is None else ground) - lo * scale)


def setup_scene(key, width, samples):
    seed, camera_xy, bearing, dusk = WORLDS[key]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 5
    scene.cycles.transparent_max_bounces = 3
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "OPTIX"
        devices = [d for d in prefs.devices if d.type == "OPTIX"] or prefs.get_devices_for_type("OPTIX")
        for device in devices:
            device.use = device.type == "OPTIX"
        if any(device.use for device in devices):
            scene.cycles.device = "GPU"
    except (TypeError, RuntimeError):
        pass
    scene.render.resolution_x, scene.render.resolution_y = width, width // 2
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.55

    world = bpy.data.worlds.new("Woodland sky")
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    normal = nodes.new("ShaderNodeTexCoord")
    height = nodes.new("ShaderNodeSeparateXYZ")
    links.new(normal.outputs["Normal"], height.inputs[0])
    sky_height = nodes.new("ShaderNodeMath")
    sky_height.operation = "MULTIPLY"
    sky_height.inputs[1].default_value = -1
    links.new(height.outputs["Z"], sky_height.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = rgb("f5d4aa" if dusk else "edecdd")
    ramp.color_ramp.elements[1].color = rgb("8190ab" if dusk else "a1cee0")
    links.new(sky_height.outputs[0], ramp.inputs[0])
    clouds = nodes.new("ShaderNodeTexNoise")
    clouds.inputs["Scale"].default_value = 4.2
    clouds.inputs["Detail"].default_value = 3
    links.new(normal.outputs["Normal"], clouds.inputs["Vector"])
    mist = nodes.new("ShaderNodeValToRGB")
    mist.color_ramp.elements[0].position, mist.color_ramp.elements[1].position = 0.53, 0.76
    links.new(clouds.outputs["Fac"], mist.inputs[0])
    blend = nodes.new("ShaderNodeMixRGB")
    links.new(mist.outputs[0], blend.inputs[0])
    links.new(ramp.outputs[0], blend.inputs[1])
    blend.inputs[2].default_value = rgb("f7e5cd" if dusk else "f3eee4")
    bg = nodes.get("Background")
    links.new(blend.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.95
    scene.world = world

    sun = bpy.data.lights.new("Afternoon sun" if dusk else "Soft morning sun", "SUN")
    sun.energy = 2.2 if dusk else 2.65
    sun.angle = math.radians(9 if dusk else 11)
    sun.color = (1.0, 0.68 if dusk else 0.86, 0.40 if dusk else 0.69)
    light = bpy.data.objects.new(sun.name, sun)
    bpy.context.collection.objects.link(light)
    light.rotation_euler = (math.radians(62 if dusk else 40), 0.25, -0.86)

    rng = random.Random(seed)
    make_land()
    woodland(rng, key, camera_xy)
    undergrowth(rng, camera_xy)
    if key in {"forest", "river"}:
        add_character("lion", *({"forest": (-4.7, 3.35), "river": (-2.65, 0.34)}[key]), 0.72, camera_xy)
    if key == "bridge":
        add_character("tortoise", -0.37, 1.36, 0.27, camera_xy, 0.38)

    data = bpy.data.cameras.new("Level 360° camera")
    data.type = "PANO"
    data.panorama_type = "EQUIRECTANGULAR"
    camera = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(camera)
    camera.location = (*camera_xy, terrain(*camera_xy) + 1.5)
    camera.rotation_euler = (math.pi / 2, 0, math.radians(bearing))
    scene.camera = camera
    return scene


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=BOOK / "assets")
    parser.add_argument("--width", type=int, default=4096)
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--scenes", nargs="+", choices=WORLDS, default=list(WORLDS))
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    args.output.mkdir(parents=True, exist_ok=True)
    for name in args.scenes:
        scene = setup_scene(name, args.width, args.samples)
        scene.render.filepath = str((args.output / f"world-{name}.jpg").resolve())
        bpy.ops.render.render(write_still=True)
