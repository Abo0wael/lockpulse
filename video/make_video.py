"""LockPulse explainer video (silent, English on-screen text): scenes drawn with Pillow, encoded with ffmpeg.

  python video/make_video.py stills   # last frame of every scene -> video/out/stills/ (+ contact sheet)
  python video/make_video.py          # render -> video/out/LockPulse_explainer.mp4

All outputs go to video/out/ (gitignored). Uses a system ffmpeg if on PATH, else the one
bundled with imageio-ffmpeg.
"""
import math, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

# Fonts: Inter + DejaVu Sans Mono where available (Linux), else Segoe UI + Consolas (Windows).
FD = "/usr/share/fonts/opentype/inter/"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONOB = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
WINF = "C:/Windows/Fonts/"
WIN_FONTS = {"Regular": "segoeui.ttf", "Medium": "segoeui.ttf", "SemiBold": "seguisb.ttf", "Bold": "segoeuib.ttf",
             "ExtraBold": "seguibl.ttf", "mono": "consola.ttf", "monob": "consolab.ttf"}
SYMBOL_FONT = WINF + "seguisym.ttf"   # has the check / cross marks Segoe UI lacks


def font_path(w):
    if w in ("mono", "monob"):
        p = MONO if w == "mono" else MONOB
    else:
        p = FD + f"Inter-{w}.otf"
    return p if os.path.exists(p) else WINF + WIN_FONTS[w]


def ffmpeg_exe():
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

BG = (13, 17, 23)
PANEL = (22, 27, 34)
LINE = (48, 54, 61)
FG = (230, 237, 243)
MUTED = (139, 148, 158)
RED = (248, 81, 73)
GREEN = (63, 185, 80)
AMBER = (210, 153, 34)
BLUE = (88, 166, 255)
PURPLE = (188, 140, 255)

_fc = {}
def F(size, w="Regular"):
    k = (size, w)
    if k not in _fc:
        f = ImageFont.truetype(font_path(w), size)
        f._lp_path = font_path(w)
        _fc[k] = f
    return _fc[k]

_cmaps = {}
def has_glyph(font, ch):
    """True if the font file maps this character (falls back to True if fontTools is missing)."""
    path = getattr(font, "_lp_path", None)
    if path is None:
        return True
    if path not in _cmaps:
        try:
            from fontTools.ttLib import TTFont
            _cmaps[path] = set(TTFont(path, fontNumber=0).getBestCmap())
        except Exception:
            _cmaps[path] = None
    cm = _cmaps[path]
    return cm is None or ord(ch) in cm or ch in "\n"

def sym_font(size):
    k = (size, "symbol")
    if k not in _fc and os.path.exists(SYMBOL_FONT):
        _fc[k] = ImageFont.truetype(SYMBOL_FONT, size)
    return _fc.get(k)

def runs(s, font):
    """Split a single line into (text, font) runs, using the symbol font for missing glyphs."""
    sym = sym_font(font.size)
    out = []
    for ch in s:
        f = font if (sym is None or has_glyph(font, ch)) else sym
        if out and out[-1][1] is f:
            out[-1][0] += ch
        else:
            out.append([ch, f])
    return out

def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3

class El:
    """A pre-drawn layer that fades/slides in at t_in."""
    def __init__(self, img, xy, t_in, dur=0.5, dy=24):
        self.img, self.xy, self.t_in, self.dur, self.dy = img, xy, t_in, dur, dy
        self.cache = {}
    def draw(self, frame, t):
        p = ease((t - self.t_in) / self.dur)
        if p <= 0:
            return
        lvl = round(p * 16) / 16
        if lvl not in self.cache:
            im = self.img.copy()
            if lvl < 1:
                a = im.getchannel("A").point(lambda v: int(v * lvl))
                im.putalpha(a)
            self.cache[lvl] = im
        x, y = self.xy
        frame.alpha_composite(self.cache[lvl], (int(x), int(y + self.dy * (1 - p))))

class Fn:
    """A layer drawn every frame by a function f(frame, draw, t)."""
    def __init__(self, f):
        self.f = f
    def draw(self, frame, t):
        self.f(frame, ImageDraw.Draw(frame), t)

def layer(w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def text(s, size, w="Regular", fill=FG, spacing=10, maxw=None):
    f = F(size, w)
    if maxw:
        words, lines, cur = s.split(), [], ""
        for wd in words:
            t = (cur + " " + wd).strip()
            if f.getlength(t) <= maxw:
                cur = t
            else:
                lines.append(cur); cur = wd
        lines.append(cur)
        s = "\n".join(lines)
    tmp = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bb = tmp.multiline_textbbox((0, 0), s, font=f, spacing=spacing)
    if all(has_glyph(f, ch) for ch in s):
        im, d = layer(bb[2] + 4, bb[3] + 8)
        d.multiline_text((0, 0), s, font=f, fill=fill, spacing=spacing)
        return im
    # some glyphs (check / cross marks) come from the symbol font: draw run by run
    line_h = tmp.textbbox((0, 0), "Ag", font=f)[3] + spacing
    lines = s.split("\n")
    width = max(sum(rf.getlength(rt) for rt, rf in runs(ln, f)) for ln in lines)
    im, d = layer(int(max(width, bb[2])) + 8, int(line_h * len(lines)) + 8)
    for i, ln in enumerate(lines):
        x = 0
        for rt, rf in runs(ln, f):
            d.text((x, i * line_h), rt, font=rf, fill=fill)
            x += rf.getlength(rt)
    return im

def T(s, x, y, t, size=40, w="Regular", fill=FG, maxw=None, anchor="l", **kw):
    im = text(s, size, w, fill, maxw=maxw)
    if anchor == "c":
        x = x - im.width / 2
    return El(im, (x, y), t, **kw)

def box(w, h, fill=PANEL, outline=LINE, r=18, width=2):
    im, d = layer(w, h)
    d.rounded_rectangle((1, 1, w - 2, h - 2), r, fill=fill, outline=outline, width=width)
    return im

def card(w, h, title, lines, accent, tsize=38, lsize=30):
    im = box(w, h, outline=accent, width=3)
    d = ImageDraw.Draw(im)
    d.text((32, 26), title, font=F(tsize, "Bold"), fill=accent)
    y = 26 + tsize + 24
    for ln, col in lines:
        sub = text(ln, lsize, "Regular", col, maxw=w - 64)
        im.alpha_composite(sub, (32, y)); y += sub.height + 14
    return im

def arrow(d, p0, p1, col, width=5, head=18):
    d.line([p0, p1], fill=col, width=width)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    a1, a2 = ang + 2.6, ang - 2.6
    d.polygon([p1, (p1[0] + head * math.cos(a1), p1[1] + head * math.sin(a1)),
               (p1[0] + head * math.cos(a2), p1[1] + head * math.sin(a2))], fill=col)

def header(title, t=0.1, kicker=None):
    els = []
    if kicker:
        els.append(T(kicker.upper(), 120, 70, t, 26, "SemiBold", BLUE))
    els.append(T(title, 120, 108, t + 0.1, 60, "Bold"))
    return els

# ---------------------------------------------------------------- scenes
def s_title():
    els = []
    def bars(frame, d, t):
        # pulse line across the screen
        x0, y0 = 120, 640
        pts = []
        for i in range(0, 1681, 6):
            x = x0 + i
            ph = (i / 1680) * 12 * math.pi - t * 4
            amp = 46 * math.exp(-((i - 840) / 420) ** 2)
            pts.append((x, y0 + amp * math.sin(ph) * ease(t / 1.2)))
        d.line(pts, fill=(*GREEN, 255), width=4)
    els.append(Fn(bars))
    els.append(T("LockPulse", W / 2, 300, 0.3, 150, "ExtraBold", anchor="c"))
    els.append(T("Detecting hangs in multithreaded C programs", W / 2, 490, 0.9, 50, "Medium", MUTED, anchor="c"))
    els.append(T("without touching the program", W / 2, 730, 1.6, 44, "SemiBold", GREEN, anchor="c"))
    els.append(T("System Programming project  ·  ECU  ·  2026", W / 2, 900, 2.2, 30, "Regular", MUTED, anchor="c"))
    return 6.0, els

def s_problem():
    els = header("The problem: programs that freeze", kicker="1 · Problem")
    # deadlock diagram
    cx = 520
    def node(label, col, w=230, h=110):
        im = box(w, h, outline=col, width=4)
        d = ImageDraw.Draw(im)
        f = F(42, "Bold")
        d.text((w / 2 - f.getlength(label) / 2, h / 2 - 26), label, font=f, fill=col)
        return im
    els.append(El(node("Thread 1", BLUE), (cx - 380, 330), 0.6))
    els.append(El(node("Thread 2", BLUE), (cx + 150, 330), 0.8))
    els.append(El(node("Lock A", AMBER, 200, 100), (cx - 365, 640), 1.0))
    els.append(El(node("Lock B", AMBER, 200, 100), (cx + 165, 640), 1.2))
    def arrows(frame, d, t):
        p = ease((t - 1.6) / 0.6)
        if p <= 0: return
        col = (*GREEN, int(255 * p))
        # holds (down, green)
        arrow(d, (cx - 265, 640), (cx - 265, 445), col)
        arrow(d, (cx + 265, 640), (cx + 265, 445), col)
        q = ease((t - 2.6) / 0.6)
        if q <= 0: return
        rc = (*RED, int(255 * q))
        arrow(d, (cx - 150, 440), (cx + 165, 650), rc, 6, 22)
        arrow(d, (cx + 150, 440), (cx - 165, 650), rc, 6, 22)
    els.append(Fn(arrows))
    els.append(T("holds", cx - 400, 520, 1.6, 28, "Medium", GREEN, dy=0))
    els.append(T("holds", cx + 290, 520, 1.6, 28, "Medium", GREEN, dy=0))
    els.append(T("waits for", cx - 75, 760, 2.6, 28, "Medium", RED, dy=0))
    rx = 1050
    els.append(T("A deadlock: each thread waits for a lock the other one holds, forever.", rx, 330, 3.2, 40, "SemiBold", maxw=760))
    els.append(T("No crash. No error message. The program just stops.", rx, 520, 4.4, 36, "Regular", MUTED, maxw=760))
    els.append(T("Some hangs have no lock cycle at all: a lost wake-up, a barrier missing a thread, a semaphore never posted.", rx, 660, 5.6, 34, "Regular", AMBER, maxw=760))
    return 10.0, els

def s_existing():
    els = header("How hangs are usually detected", kicker="2 · Existing approaches")
    els.append(El(card(780, 430, "Timeout", [
        ("Alert if nothing happens for T seconds.", FG),
        ("✗  Slow: has to wait seconds", RED),
        ("✗  False alarms when threads are just sleeping or waiting for I/O", RED)], AMBER), (120, 270), 0.6))
    els.append(El(card(780, 430, "Wait-for graph", [
        ("Track every lock and look for a cycle.", FG),
        ("✗  Needs to instrument every lock call", RED),
        ("✗  Blind to hangs without a lock cycle", RED)], PURPLE), (1020, 270), 1.4))
    els.append(T("Can we detect hangs fast, cheaply, and without instrumenting the program?", W / 2, 800, 2.6, 46, "SemiBold", GREEN, anchor="c", maxw=1600))
    return 9.0, els

def s_system():
    els = header("Our system: two views of the same run", kicker="3 · LockPulse")
    els.append(El(box(380, 170, outline=FG, width=3), (120, 470), 0.4))
    els.append(T("C program", 310, 505, 0.4, 40, "Bold", anchor="c", dy=0))
    els.append(T("unmodified", 310, 565, 0.4, 30, "Regular", MUTED, anchor="c", dy=0))
    # tier P
    els.append(El(card(640, 250, "Tier P  ·  /proc sampler", [
        ("Every 5 ms: thread state, CPU time, context switches, current syscall", FG)], GREEN, 36, 30), (640, 250), 1.0))
    els.append(El(card(500, 250, "Detector", [
        ("Rules + ML models. Raises an alert.", FG)], GREEN, 36, 30), (1340, 250), 1.6))
    # tier F
    els.append(El(card(640, 250, "Tier F  ·  LD_PRELOAD shim", [
        ("Logs every lock, condvar, semaphore and barrier call", FG)], BLUE, 36, 30), (640, 640), 2.4))
    els.append(El(card(500, 250, "Ground truth", [
        ("When the hang began + the wait-for graph baseline", FG)], BLUE, 36, 30), (1340, 640), 3.0))
    def arr(frame, d, t):
        for t0, a, b, c in [(1.0, (500, 520), (640, 375), GREEN), (1.6, (1280, 375), (1340, 375), GREEN),
                            (2.4, (500, 590), (640, 765), BLUE), (3.0, (1280, 765), (1340, 765), BLUE)]:
            p = ease((t - t0) / 0.5)
            if p > 0:
                arrow(d, a, b, (*c, int(255 * p)))
    els.append(Fn(arr))
    els.append(T("Only Tier P feeds the detector. Tier F is used to grade it.", W / 2, 960, 3.8, 38, "SemiBold", AMBER, anchor="c"))
    return 10.0, els

def s_bench():
    els = header("A benchmark we built and labeled", kicker="4 · Data")
    stats = [("13", "scenario families"), ("780", "runs"), ("381", "hangs (166 deadlocks)"), ("398", "healthy runs")]
    for i, (n, lab) in enumerate(stats):
        x = 120 + i * 430
        els.append(T(n, x, 250, 0.5 + i * 0.3, 110, "ExtraBold", GREEN if i else FG))
        els.append(T(lab, x, 390, 0.6 + i * 0.3, 32, "Medium", MUTED))
    hang = ["two-lock inversion", "three-thread cycle", "dining philosophers", "lost wake-up",
            "producer-consumer, missing signal", "barrier mismatch", "semaphore never posted"]
    ok = ["high contention", "long critical section", "consistent lock order", "sleeping workers",
          "producer-consumer, correct", "blocked on I/O"]
    def chips(items, col, y, t0):
        x = 120
        out = []
        for i, s in enumerate(items):
            f = F(28, "Medium")
            w = int(f.getlength(s)) + 48
            if x + w > W - 120:
                x = 120; y += 72
            im = box(w, 56, fill=(*col, 40), outline=col, r=28, width=2)
            ImageDraw.Draw(im).text((24, 11), s, font=f, fill=FG)
            out.append(El(im, (x, y), t0 + i * 0.12, dy=12))
            x += w + 16
        return out
    els.append(T("Hang", 120, 500, 1.8, 30, "Bold", RED))
    els += chips(hang, RED, 550, 1.9)
    els.append(T("Healthy (some look like hangs)", 120, 760, 2.9, 30, "Bold", GREEN))
    els += chips(ok, GREEN, 810, 3.0)
    els.append(T("Split by family into train / validation / test. Test families were opened only once, at the very end.", W / 2, 990, 4.2, 32, "Medium", AMBER, anchor="c"))
    return 10.0, els

def s_detectors():
    els = header("Seven detectors, compared fairly", kicker="5 · Method")
    rows = [("B1", "Fixed timeout", "Tier P", "rule", MUTED), ("B2", "Futex silence: every thread stuck in futex", "Tier P", "rule", MUTED),
            ("B3", "Wait-for graph cycle", "Tier F", "rule", MUTED), ("B4", "Progress watchdog", "Tier F", "rule", MUTED),
            ("M1", "Logistic regression", "Tier P", "ML", BLUE), ("M2", "Random forest", "Tier P", "ML", BLUE),
            ("M3", "Gradient boosting", "Tier P", "ML", BLUE)]
    for i, (k, name, tier, kind, col) in enumerate(rows):
        y = 260 + i * 92
        im = box(1680, 76, r=14)
        d = ImageDraw.Draw(im)
        d.text((28, 16), k, font=F(36, "monob"), fill=col if kind == "ML" else AMBER)
        d.text((150, 18), name, font=F(34, "Medium"), fill=FG)
        d.text((1300, 20), tier, font=F(30, "Medium"), fill=GREEN if tier == "Tier P" else BLUE)
        d.text((1500, 20), kind, font=F(30, "Medium"), fill=MUTED)
        els.append(El(im, (120, y), 0.5 + i * 0.25, dy=14))
    els.append(T("Every threshold chosen on validation only, then frozen before the test run.", W / 2, 935, 2.8, 34, "Medium", AMBER, anchor="c"))
    return 8.0, els

RES = [("B1", "Fixed timeout", 1512, "91/91", 23), ("B2", "Futex silence", 69, "91/91", 0),
       ("B3", "Wait-for graph", 0.5, "46/91", 0), ("B4", "Progress watchdog", 1513, "91/91", 23),
       ("M1", "Logistic regr.", 36, "91/91", 15), ("M2", "Random forest", 47, "91/91", 0),
       ("M3", "Gradient boosting", 55, "91/91", 0)]

def s_results():
    els = header("Test results: 180 unseen runs, 91 hangs", kicker="6 · Results")
    x0, xbar, bw = 120, 620, 760
    y0 = 300
    els.append(T("median detection delay (log scale)", xbar, 240, 0.3, 26, "Medium", MUTED))
    els.append(T("detected", 1440, 240, 0.3, 26, "Medium", MUTED))
    els.append(T("false alarms", 1620, 240, 0.3, 26, "Medium", MUTED))
    lo, hi = math.log10(10), math.log10(3000)
    def bars(frame, d, t):
        for i, (k, name, ms, det, fa) in enumerate(RES):
            y = y0 + i * 88
            ti = 0.6 + i * 0.35
            p = ease((t - ti) / 0.8)
            if p <= 0: continue
            a = int(255 * min(1, p * 2))
            good = fa == 0 and det == "91/91"
            col = GREEN if good else (PURPLE if k == "B3" else RED)
            d.text((x0, y + 8), k, font=F(36, "monob"), fill=(*AMBER, a) if k[0] == "B" else (*BLUE, a))
            d.text((x0 + 90, y + 10), name, font=F(32, "Medium"), fill=(*FG, a))
            d.rounded_rectangle((xbar, y + 10, xbar + bw, y + 54), 10, fill=(*PANEL, a))
            if k == "B3":
                d.text((xbar + 20, y + 14), "instant, but deadlocks only", font=F(30, "Medium"), fill=(*PURPLE, a))
            else:
                frac = (math.log10(ms) - lo) / (hi - lo)
                d.rounded_rectangle((xbar, y + 10, xbar + max(20, bw * frac * p), y + 54), 10, fill=(*col, a))
                lab = f"{ms/1000:.1f} s" if ms >= 1000 else f"{ms:.0f} ms"
                d.text((xbar + bw * frac * p + 16, y + 14), lab, font=F(30, "SemiBold"), fill=(*FG, a))
            d.text((1440, y + 12), det, font=F(32, "SemiBold"), fill=(*(GREEN if det == "91/91" else PURPLE), a))
            d.text((1660, y + 12), str(fa), font=F(32, "SemiBold"), fill=(*(GREEN if fa == 0 else RED), a))
    els.append(Fn(bars))
    els.append(T("Timeouts must wait 1.5 s and still false-alarm on blocked-on-I/O runs.  B2, M2, M3: every hang in ~50-70 ms, zero false alarms.",
                 W / 2, 945, 3.8, 32, "Medium", FG, anchor="c", maxw=1680))
    return 12.0, els

def s_finding():
    els = header("What made it work", kicker="7 · Key finding")
    els.append(T("Which system call a stuck thread is waiting in.", 120, 230, 0.4, 46, "SemiBold", GREEN))
    rows = [("futex", "waiting on a lock, condvar or semaphore", RED, "suspicious"),
            ("read / poll", "waiting for I/O", GREEN, "normal"),
            ("nanosleep", "sleeping on purpose", GREEN, "normal")]
    for i, (sc, desc, col, verdict) in enumerate(rows):
        im = box(1120, 82, r=14)
        d = ImageDraw.Draw(im)
        d.text((28, 18), sc, font=F(36, "monob"), fill=col)
        d.text((320, 22), desc, font=F(30, "Regular"), fill=FG)
        d.text((950, 22), verdict, font=F(30, "SemiBold"), fill=col)
        els.append(El(im, (120, 330 + i * 100), 1.0 + i * 0.4, dy=12))
    els.append(El(card(520, 300, "Ablation", [
        ("Remove the syscall features and the models detect", FG),
        ("0 / 91 hangs", RED)], AMBER, 36, 32), (1280, 330), 2.6))
    # overhead bars
    els.append(T("Overhead on the traced program (slowdown)", 120, 700, 3.4, 34, "SemiBold"))
    def ob(frame, d, t):
        p = ease((t - 3.8) / 0.8)
        if p <= 0: return
        a = int(255 * min(1, 2 * p))
        for i, (lab, lo_, hi_, col) in enumerate([("Tier P  /proc sampler", 1.00, 1.15, GREEN), ("Tier F  LD_PRELOAD shim", 1.21, 1.78, BLUE)]):
            y = 770 + i * 90
            d.text((120, y + 10), lab, font=F(32, "Medium"), fill=(*FG, a))
            sx = 620; scale = 900
            d.rounded_rectangle((sx, y + 10, sx + scale, y + 54), 10, fill=(*PANEL, a))
            d.rounded_rectangle((sx, y + 10, sx + scale * (hi_ - 1 + 0.02) / 0.8 * p, y + 54), 10, fill=(*col, a))
            d.text((sx + scale + 24, y + 12), f"{lo_:.2f}-{hi_:.2f}×", font=F(32, "SemiBold"), fill=(*col, a))
    els.append(Fn(ob))
    return 10.0, els

def s_takeaways():
    els = header("What we learned", kicker="8 · Takeaways")
    items = [("✓", "Every hang in unseen scenarios caught in about 50-70 ms, with zero false alarms.", GREEN),
             ("✓", "Almost free: reading /proc slows the program by 1.00-1.15x, within measurement noise.", GREEN),
             ("✓", "Catches hangs a wait-for graph cannot see (semaphores, barriers, condvars).", GREEN),
             ("!", "Honest result: on this benchmark a simple rule (B2) matches the ML models.", AMBER)]
    for i, (m, s, col) in enumerate(items):
        y = 260 + i * 130
        els.append(T(m, 120, y, 0.5 + i * 0.7, 48, "Bold", col))
        els.append(T(s, 200, y + 4, 0.5 + i * 0.7, 40, "Medium", FG, maxw=1560))
    els.append(El(card(1680, 200, "Next", [
        ("Harder healthy cases (e.g. an idle thread pool where every thread waits in futex) where the rule should break, then a paper.", FG)],
        BLUE, 32, 30), (120, 790), 3.6))
    return 10.0, els

def s_end():
    els = [T("LockPulse", W / 2, 360, 0.2, 130, "ExtraBold", anchor="c"),
           T("Two-tier hang detection for multithreaded C programs", W / 2, 540, 0.6, 42, "Medium", MUTED, anchor="c"),
           T("github.com/Abo0wael/lockpulse", W / 2, 680, 1.0, 40, "monob", GREEN, anchor="c")]
    return 5.0, els

SCENES = [s_title, s_problem, s_existing, s_system, s_bench, s_detectors, s_results, s_finding, s_takeaways, s_end]

def frame_at(els, t, dur):
    fr = Image.new("RGBA", (W, H), (*BG, 255))
    for e in els:
        e.draw(fr, t)
    # fade from / to black inside the scene
    k = min(1.0, t / 0.35, (dur - t) / 0.35)
    if k < 1:
        fr = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), fr, max(0.0, k))
    return fr.convert("RGB")


def stills():
    """Last fully visible frame of every scene (before the fade to black) + a contact sheet."""
    os.makedirs(f"{OUT}/stills", exist_ok=True)
    paths = []
    for i, sc in enumerate(SCENES):
        dur, els = sc()
        p = f"{OUT}/stills/s{i + 1:02d}.png"
        frame_at(els, dur - 0.5, dur).save(p)
        paths.append(p)
    sheet = Image.new("RGB", (2 * 960, 5 * 540), BG)
    for i, p in enumerate(paths):
        sheet.paste(Image.open(p).resize((960, 540)), ((i % 2) * 960, (i // 2) * 540))
    sheet.save(f"{OUT}/stills/contact_sheet.png")


def render():
    os.makedirs(f"{OUT}/parts", exist_ok=True)
    names = []
    for i, sc in enumerate(SCENES):
        dur, els = sc()
        n = int(round(dur * FPS))
        final = f"{OUT}/parts/p{i:02d}.mp4"; tmp = f"{OUT}/parts/p{i:02d}.tmp.mp4"
        cmd = [ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
               "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
               "-pix_fmt", "yuv420p", "-r", str(FPS), tmp]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(n):
            p.stdin.write(frame_at(els, f / FPS, dur).tobytes())
        p.stdin.close()
        if p.wait() != 0:
            sys.exit(f"ffmpeg failed on scene {i}")
        os.replace(tmp, final)
        names.append(final)
        print("scene", i, "done", flush=True)
    with open(f"{OUT}/parts/list.txt", "w", encoding="utf-8") as fh:
        for nm in names:
            fh.write("file '{}'\n".format(nm.replace("\\", "/").replace("'", "'\''")))
    subprocess.run([ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i",
                    f"{OUT}/parts/list.txt", "-c", "copy", "-movflags", "+faststart",
                    f"{OUT}/LockPulse_explainer.mp4"], check=True)


if __name__ == "__main__":
    stills() if sys.argv[1:] == ["stills"] else render()
