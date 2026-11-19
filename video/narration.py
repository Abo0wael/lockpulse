"""Narration for the LockPulse explainer: one MP3 per scene via edge-tts.

  python video/narration.py [--lang en|ar]   # writes video/out/audio_<lang>/sNN.mp3 + durations.json

en (default): English, voice en-US-GuyNeural, rate -5%. Some words are spelled for speech
              ("slash proc", "I-O", "L-D PRELOAD") so the voice pronounces them right.
ar:           Egyptian Arabic, voice ar-EG-ShakirNeural, rate -5% (technical words in English).
"""
import asyncio
import json
import os
import re
import subprocess
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
VOICES = {"en": ("en-US-GuyNeural", "-5%"), "ar": ("ar-EG-ShakirNeural", "-5%")}
# (en-US-AndrewNeural returned no audio for most requests on 2026-11-19; en-US-BrianNeural also works.)


def audio_dir(lang):
    return os.path.join(OUT, "audio_" + lang)


SCRIPT_EN = [
    "This is LockPulse, our System Programming project. In one sentence: we detect when a multithreaded C "
    "program has hung, without touching the program itself.",
    "Picture two threads. Thread one holds lock A and waits for lock B. Thread two holds lock B and waits for "
    "lock A. Each one waits for the other, forever. That's a deadlock. The program doesn't crash, and it prints "
    "no error. It just stops. And some hangs have no lock cycle at all: a wake-up signal that gets lost, or a "
    "semaphore that nobody ever posts.",
    "The usual approaches have problems. A timeout has to wait for seconds, and it raises false alarms when "
    "threads are simply sleeping, or waiting for I-O. A wait-for graph has to instrument every lock in the "
    "program, and it can't see any hang without a lock cycle. So our question was: can we detect hangs quickly, "
    "cheaply, and without modifying the program?",
    "We built a system that watches the same run from two angles. The first is Tier P: a sampler that reads "
    "slash proc every five milliseconds, and records each thread's state, its CPU time, its context switches, "
    "and the system call it is blocked in. That is the only thing the detector ever sees. The second is Tier F: "
    "an L-D PRELOAD library that logs every lock, condition variable, semaphore and barrier call. We use it only "
    "to establish the ground truth, and to grade the detectors.",
    "We built a benchmark of thirteen scenarios: seven that hang, and six that run normally, although some of "
    "them look a lot like a hang from the outside. We ran them seven hundred and eighty times, including three "
    "hundred and eighty-one hangs. We split the scenarios into training, validation and test, and we opened the "
    "test scenarios only once, at the very end.",
    "We compared seven detectors: four rules, two on Tier P and two on Tier F, and three machine-learning "
    "models. Every threshold was chosen on the validation set, and frozen before the test.",
    "Here are the results, on one hundred and eighty runs that no detector had seen before. The timeouts have "
    "to wait a second and a half, and they still raise false alarms on runs that are waiting for I-O. The "
    "wait-for graph catches deadlocks instantly, but it misses every hang that doesn't involve locks. The futex "
    "rule, the random forest, and gradient boosting caught every single hang, in about fifty to seventy "
    "milliseconds, with zero false alarms.",
    "So what's the secret? The system call a stuck thread is waiting in. If it's blocked in futex, it's waiting "
    "for a lock or a signal, and that is suspicious. If it's in read, or sleep, it's doing something normal. "
    "When we removed that information, the models caught no hangs at all. And reading slash proc costs almost "
    "nothing, unlike Tier F.",
    "To sum up: a system that detects hangs fast, almost for free, and sees hangs that a wait-for graph can't. "
    "And the honest result: on this benchmark, a simple rule matched machine learning. Next, we'll test harder "
    "scenarios, like an idle thread pool, to see whether machine learning makes a difference, and then write a "
    "research paper.",
    "That was LockPulse. All the code is on GitHub. Thank you.",
]

SCRIPT_AR = [
    "ده LockPulse، مشروع System Programming بتاعنا. الفكرة باختصار: نكتشف إن برنامج C فيه threads كتير علّق، من غير ما نلمس البرنامج نفسه.",
    "تخيّل threadين: الأول ماسك Lock A ومستني Lock B، والتاني ماسك Lock B ومستني Lock A. كل واحد مستني التاني للأبد، وده اسمه deadlock. البرنامج مبيقعش ومبيطلّعش error، هو بس بيقف. وفيه hangs تانية مفيهاش دايرة locks أصلًا، زي signal ضاع، أو semaphore محدش عمله post.",
    "الطرق المعروفة ليها مشاكل. الـ timeout بيستنى ثواني، وبيدّي إنذار غلط لو الـ threads نايمة أو مستنية I/O. والـ wait-for graph محتاج نراقب كل lock في البرنامج، ومبيشوفش أي hang مفيهوش دايرة locks. فسؤالنا كان: نقدر نكتشف الـ hang بسرعة، وبتكلفة قليلة، ومن غير ما نعدّل البرنامج؟",
    "عملنا نظام بيشوف نفس الـ run من زاويتين. الأولى Tier P: برنامج بيقرا من proc كل خمسة ملي ثانية حالة كل thread، ووقت الـ CPU، والـ context switches، والـ syscall اللي واقف فيه. ودي الحاجة الوحيدة اللي الـ detector بيشوفها. التانية Tier F: مكتبة بـ LD_PRELOAD بتسجّل كل lock وcondition variable وsemaphore وbarrier، وبنستخدمها بس عشان نعرف الحقيقة ونقيّم بيها.",
    "بنينا benchmark من تلاتاشر سيناريو: سبعة بيعلّقوا، وستة شغالين عادي بس بعضهم شكله شبه المعلّق. شغّلناهم سبعمية وتمانين مرة، منهم تلتمية واحد وتمانين hang. وقسمنا السيناريوهات train وvalidation وtest، والـ test مفتحناهوش غير مرة واحدة في الآخر.",
    "قارنّا سبع detectors: أربع rules، اتنين على Tier P واتنين على Tier F، وتلات موديلات machine learning. وكل الـ thresholds اتختارت على الـ validation واتجمّدت قبل الـ test.",
    "دي النتايج على مية وتمانين run محدش شافهم قبل كده. الـ timeout لازم يستنى ثانية ونص، وبرضه بيغلط في الـ runs اللي مستنية I/O. الـ wait-for graph بيكتشف الـ deadlock فورًا، بس بيفوّت أي hang مفيهوش locks. أما الـ futex rule والـ random forest والـ gradient boosting فاكتشفوا كل الـ hangs في حوالي خمسين لسبعين ملي ثانية، من غير ولا إنذار غلط.",
    "إيه السر؟ الـ syscall اللي الـ thread واقف فيه. لو واقف في futex يبقى مستني lock أو signal، ودي حاجة مريبة. لو في read أو sleep يبقى شغال طبيعي. ولما شلنا المعلومة دي، الموديلات مكتشفتش ولا hang. وقراءة proc تكلفتها تقريبًا صفر، بعكس الـ Tier F.",
    "الخلاصة: نظام بيكتشف الـ hang بسرعة، وببلاش تقريبًا، وبيشوف حاجات الـ wait-for graph مش شايفها. والنتيجة الصادقة: على الـ benchmark ده، rule بسيطة ساوت الـ ML. الخطوة الجاية سيناريوهات أصعب، زي thread pool فاضي، عشان نشوف الـ ML هيفرق ولا لأ، وبعدها ورقة بحثية.",
    "ده كان LockPulse. الكود كله على GitHub. شكرًا.",
]


def ffmpeg_exe():
    from shutil import which
    if which("ffmpeg"):
        return "ffmpeg"
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def duration_s(path):
    """Decode the file fully and return its duration (more exact than the header for MP3)."""
    p = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", path, "-f", "null", "-"], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    times = re.findall(r"time=(\d+):(\d+):([\d.]+)", p.stderr)
    if not times:
        raise RuntimeError("cannot read duration of " + path)
    h, m, s = times[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


async def synth(i, text, lang):
    import edge_tts
    voice, rate = VOICES[lang]
    path = os.path.join(audio_dir(lang), "s{:02d}.mp3".format(i + 1))
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(path)
            return path
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 3:
                raise
            print("  no audio for scene {} (attempt {}), retrying".format(i + 1, attempt + 1), flush=True)
            await asyncio.sleep(2 * (attempt + 1))


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="Generate the scene narration MP3s.")
    ap.add_argument("--lang", choices=sorted(VOICES), default="en")
    lang = ap.parse_args(argv).lang
    script = SCRIPT_EN if lang == "en" else SCRIPT_AR
    AUDIO = audio_dir(lang)
    os.makedirs(AUDIO, exist_ok=True)
    print("voice {} rate {}".format(*VOICES[lang]))
    durs = {}
    for i, text in enumerate(script):
        path = asyncio.run(synth(i, text, lang))
        durs["s{:02d}".format(i + 1)] = round(duration_s(path), 3)
        print("s{:02d}: {:.2f} s".format(i + 1, durs["s{:02d}".format(i + 1)]), flush=True)
    with open(os.path.join(AUDIO, "durations.json"), "w", encoding="utf-8") as fh:
        json.dump(durs, fh, indent=2)
    print("total narration: {:.1f} s".format(sum(durs.values())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
