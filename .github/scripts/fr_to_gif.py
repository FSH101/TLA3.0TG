#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FR/FRM → GIF конвертер с палитрой Fallout.
- Рекурсивно обходит исходную директорию.
- Поддерживает классический макет FRM (A) и вариант с таблицами смещений (B).
- По умолчанию пишет 6 GIF: __dir0..__dir5 (если направления есть).
- Прозрачность: индекс 0 = alpha 0.
"""

import argparse, os, sys
from pathlib import Path
from typing import List, Tuple, Optional
from PIL import Image

# --- Палитра Fallout (JASC-PAL 256) ---
_PAL_STR = """JASC-PAL
0100
256
0 0 255
236 236 236
220 220 220
204 204 204
188 188 188
176 176 176
160 160 160
144 144 144
128 128 128
116 116 116
100 100 100
84 84 84
72 72 72
56 56 56
40 40 40
32 32 32
252 236 236
236 216 216
220 196 196
208 176 176
192 160 160
176 144 144
164 128 128
148 112 112
132 96 96
120 84 84
104 68 68
88 56 56
76 44 44
60 36 36
44 24 24
32 16 16
236 236 252
216 216 236
196 196 220
176 176 208
160 160 192
144 144 176
128 128 164
112 112 148
96 96 132
84 84 120
68 68 104
56 56 88
44 44 76
36 36 60
24 24 44
16 16 32
252 176 240
196 96 168
104 36 96
76 20 72
56 12 52
40 16 36
36 4 36
28 12 24
252 252 200
252 252 124
228 216 12
204 184 28
184 156 40
164 136 48
144 120 36
124 104 24
108 88 16
88 72 8
72 56 4
52 40 0
32 24 0
216 252 156
180 216 132
152 184 112
120 152 92
92 120 72
64 88 52
40 56 32
112 96 80
84 72 52
56 48 32
104 120 80
112 120 32
112 104 40
96 96 36
76 68 36
56 48 32
156 172 156
120 148 120
88 124 88
64 104 64
56 88 88
48 76 72
40 68 60
32 60 44
28 48 36
20 40 24
16 32 16
24 48 24
16 36 12
8 28 4
4 20 0
4 12 0
140 156 156
120 148 152
100 136 148
80 124 144
64 108 140
48 88 140
44 76 124
40 68 108
32 56 92
28 48 76
24 40 64
156 164 164
56 72 104
80 88 88
88 104 132
56 64 80
188 188 188
172 164 152
160 144 124
148 124 96
136 104 76
124 88 52
112 72 36
100 60 20
88 48 8
252 204 204
252 176 176
252 152 152
252 124 124
252 100 100
252 72 72
252 48 48
252 0 0
224 0 0
196 0 0
168 0 0
144 0 0
116 0 0
88 0 0
64 0 0
252 224 200
252 196 148
252 184 120
252 172 96
252 156 72
252 148 44
252 136 20
252 124 0
220 108 0
192 96 0
164 80 0
132 68 0
104 52 0
76 36 0
48 24 0
248 212 164
216 176 120
200 160 100
188 144 84
172 128 68
156 116 52
140 100 40
124 88 28
112 76 20
96 64 8
80 52 4
64 40 0
52 32 0
252 228 184
232 200 152
212 172 124
196 144 100
176 116 76
160 92 56
144 76 44
132 60 32
120 44 24
108 32 16
92 20 8
72 12 4
60 4 0
252 232 220
248 212 188
244 192 160
240 176 132
240 160 108
240 148 92
216 128 84
192 112 72
168 96 64
144 80 56
120 64 48
96 48 36
72 36 28
56 24 20
100 228 100
20 152 20
0 164 0
80 80 72
0 108 0
140 140 132
28 28 28
104 80 56
48 40 32
140 112 96
72 56 40
12 12 12
60 60 60
108 116 108
120 132 120
136 148 136
148 164 148
88 104 96
96 112 104
60 248 0
56 212 8
52 180 16
48 148 20
40 116 24
252 252 252
240 236 208
208 184 136
152 124 80
104 88 60
80 64 36
52 40 28
24 16 12
0 0 0
0 108 0
11 115 7
27 123 15
43 131 27
107 107 111
99 103 127
87 107 143
0 147 163
107 187 255
255 0 0
215 0 0
147 43 11
255 119 0
255 59 0
71 0 0
123 0 0
179 0 0
123 0 0
71 0 0
83 63 43
75 59 43
67 55 39
63 51 39
55 47 35
51 43 35
252 0 0
255 255 255
"""

def load_palette() -> List[int]:
    lines = [ln.strip() for ln in _PAL_STR.splitlines() if ln.strip()]
    # отбрасываем заголовки JASC
    rgb = []
    # находим строку с "256", после неё идут 256 строк RGB
    idx = 0
    for i, ln in enumerate(lines):
        if ln.isdigit() and int(ln) == 256:
            idx = i + 1
            break
    for j in range(256):
        r, g, b = map(int, lines[idx + j].split())
        rgb.extend([r, g, b])
    return rgb  # len=768

class FrmFrame:
    __slots__ = ("w","h","ox","oy","data")
    def __init__(self, w:int, h:int, ox:int, oy:int, data:bytes):
        self.w, self.h, self.ox, self.oy, self.data = w, h, ox, oy, data

class FrmDir:
    __slots__ = ("frames",)
    def __init__(self, frames:List[FrmFrame]): self.frames = frames

class FrmAtlas:
    __slots__ = ("dirs","fps")
    def __init__(self, dirs:List[FrmDir], fps:int): self.dirs, self.fps = dirs, fps

def _u16(buf:bytes, o:int) -> int:
    return int.from_bytes(buf[o:o+2], "little", signed=False)
def _i16(buf:bytes, o:int) -> int:
    return int.from_bytes(buf[o:o+2], "little", signed=True)
def _u32(buf:bytes, o:int) -> int:
    return int.from_bytes(buf[o:o+4], "little", signed=False)

def parse_frm(buf:bytes) -> FrmAtlas:
    """
    Пытаемся макет A → макет B. Если оба не зашли — ошибка.
    Макет A (классический):
      u16 fps, u16 action, u16 framesPerDir, u16 dirs (обычно 6),
      6×u32 offsets на блоки направлений,
      в каждом направлении: на каждый кадр подряд (w,h,ox,oy, затем w*h байт индексов).
    Макет B:
      может начинаться с u32 version, затем как A; либо таблица оффсетов кадров.
    """
    # попытка A (с нуля)
    try:
      return _parse_layout_a(buf, 0)
    except Exception:
      pass
    # попытка A c возможным u32 version в начале
    try:
      return _parse_layout_a(buf, 4)
    except Exception:
      pass
    # попытка B (у каждой дир — таблица кадров)
    try:
      return _parse_layout_b(buf, 0)
    except Exception:
      pass
    try:
      return _parse_layout_b(buf, 4)
    except Exception as e:
      raise RuntimeError("Unsupported FRM/FR layout: " + str(e))

def _parse_layout_a(buf:bytes, base:int) -> FrmAtlas:
    if base + 8 + 24 > len(buf):
        raise ValueError("too small for layout A")
    fps          = _u16(buf, base + 0)
    _action      = _u16(buf, base + 2)
    frames_per_d = _u16(buf, base + 4)
    dir_count    = _u16(buf, base + 6)
    if not (1 <= frames_per_d <= 32): raise ValueError("frames_per_d out of range")
    if not (1 <= dir_count <= 6): dir_count = min(dir_count, 6) if dir_count>0 else 6
    dir_off = [ _u32(buf, base + 8 + i*4) for i in range(6) ]
    dirs: List[FrmDir] = []
    for d in range(dir_count):
        off = dir_off[d]
        if off == 0 or off >= len(buf): raise ValueError("bad dir offset")
        frames: List[FrmFrame] = []
        p = off
        for _ in range(frames_per_d):
            if p + 8 > len(buf): raise ValueError("frame header overflow")
            w  = _i16(buf, p+0); h = _i16(buf, p+2)
            ox = _i16(buf, p+4); oy= _i16(buf, p+6)
            p += 8
            if w<=0 or h<=0: raise ValueError("bad wh")
            need = w*h
            if p + need > len(buf): raise ValueError("pixels overflow A")
            data = buf[p:p+need]
            p += need
            frames.append(FrmFrame(w,h,ox,oy,data))
        dirs.append(FrmDir(frames))
    if fps<=0 or fps>60: fps=10
    return FrmAtlas(dirs, fps)

def _parse_layout_b(buf:bytes, base:int) -> FrmAtlas:
    # предположим: заголовок как у A, но после него идут таблицы оффсетов кадров
    if base + 8 + 24 > len(buf):
        raise ValueError("too small for layout B")
    fps          = _u16(buf, base + 0)
    _action      = _u16(buf, base + 2)
    frames_per_d = _u16(buf, base + 4)
    dir_count    = _u16(buf, base + 6)
    if not (1 <= frames_per_d <= 32): raise ValueError("frames_per_d out of range")
    if not (1 <= dir_count <= 6): dir_count = min(dir_count, 6) if dir_count>0 else 6
    # таблица оффсетов кадров для каждоого направления:
    # сразу после 8 байт заголовка ожидаем 6 * frames_per_d * u32
    table_off = base + 8
    need = 6*frames_per_d*4
    if table_off + need > len(buf): raise ValueError("no room for frame offset table B")
    dirs: List[FrmDir] = []
    for d in range(dir_count):
        frames: List[FrmFrame] = []
        for f in range(frames_per_d):
            off = _u32(buf, table_off + (d*frames_per_d + f)*4)
            if off==0 or off+8>=len(buf): raise ValueError("bad frame off")
            w  = _i16(buf, off+0); h = _i16(buf, off+2)
            ox = _i16(buf, off+4); oy = _i16(buf, off+6)
            pix = off+8
            if w<=0 or h<=0: raise ValueError("bad wh B")
            need_pix = w*h
            if pix + need_pix > len(buf): raise ValueError("pixels overflow B")
            data = buf[pix: pix+need_pix]
            frames.append(FrmFrame(w,h,ox,oy,data))
        dirs.append(FrmDir(frames))
    if fps<=0 or fps>60: fps=10
    return FrmAtlas(dirs, fps)

def frames_to_gif(frames: List[FrmFrame], palette: List[int], out_path: Path, fps: float, fps_scale: float):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    duration_ms = max(1, int(1000.0 / max(1e-6, fps * fps_scale)))
    imgs: List[Image.Image] = []

    # Готовим палитру для Pillow: список длиной 768 (256*3)
    pal_flat = palette[:]
    # индекс 0 — прозрачный (оставим таким же цветом, но прозрачным)
    for idx, fr in enumerate(frames):
        w,h = fr.w, fr.h
        im = Image.frombytes("P", (w,h), fr.data)
        im.putpalette(pal_flat)
        im.info["transparency"] = 0
        imgs.append(im)

    if not imgs:
        return

    if len(imgs)==1:
        imgs[0].save(out_path, save_all=False, transparency=0, optimize=False, disposal=2)
    else:
        imgs[0].save(
            out_path,
            save_all=True,
            append_images=imgs[1:],
            duration=duration_ms,
            loop=0,
            transparency=0,
            optimize=False,
            disposal=2
        )

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--split-dirs", default="true")
    ap.add_argument("--fps-scale", default="1.0")
    args = ap.parse_args()

    src = Path(args.src).resolve()
    dst = Path(args.dst).resolve()
    split_dirs = str(args.split_dirs).lower() in ("1","true","yes","y","on")
    try:
        fps_scale = float(args.fps_scale)
    except:
        fps_scale = 1.0

    pal = load_palette()

    exts = (".frm",".fr0",".fr1",".fr2",".fr3",".fr4",".fr5",".fr6",".fr7",".fr8",".fr9",".frx",".frz")
    found = 0
    ok = 0
    err = 0

    for p in src.rglob("*"):
        if not p.is_file(): continue
        if p.suffix.lower() not in exts: continue
        found += 1
        rel = p.relative_to(src)
        base_name = rel.name
        name_wo_ext = base_name[:base_name.rfind(".")] if "." in base_name else base_name

        try:
            data = p.read_bytes()
            atlas = parse_frm(data)
            if not atlas.dirs:
                err += 1
                print(f"[WARN] No dirs: {p}", file=sys.stderr)
                continue

            if split_dirs:
                for d, dseq in enumerate(atlas.dirs):
                    out_rel = rel.with_name(f"{name_wo_ext}__dir{d}.gif")
                    out_path = dst.joinpath(out_rel)
                    frames_to_gif(dseq.frames, pal, out_path, atlas.fps, fps_scale)
            else:
                # только направление 0
                out_rel = rel.with_name(f"{name_wo_ext}.gif")
                out_path = dst.joinpath(out_rel)
                frames_to_gif(atlas.dirs[0].frames, pal, out_path, atlas.fps, fps_scale)

            ok += 1
            print(f"[OK] {rel}")

        except Exception as e:
            err += 1
            print(f"[ERR] {rel} → {e}", file=sys.stderr)

    print(f"\nDone. scanned={found} ok={ok} err={err}")
    if ok==0:
        sys.exit(1)

if __name__ == "__main__":
    main()
