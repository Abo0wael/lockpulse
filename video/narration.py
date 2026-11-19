"""Arabic (Egyptian) narration for the LockPulse explainer: one MP3 per scene via edge-tts.

  python video/narration.py        # writes video/out/audio/sNN.mp3 + durations.json

Voice ar-EG-ShakirNeural, rate -5%. Technical words stay in English exactly as written.
"""
import asyncio
import json
import os
import re
import subprocess
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
AUDIO = os.path.join(OUT, "audio")
VOICE = "ar-EG-ShakirNeural"
RATE = "-5%"

SCRIPT = [
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


async def synth(i, text):
    import edge_tts
    path = os.path.join(AUDIO, "s{:02d}.mp3".format(i + 1))
    await edge_tts.Communicate(text, VOICE, rate=RATE).save(path)
    return path


def main():
    os.makedirs(AUDIO, exist_ok=True)
    durs = {}
    for i, text in enumerate(SCRIPT):
        path = asyncio.run(synth(i, text))
        durs["s{:02d}".format(i + 1)] = round(duration_s(path), 3)
        print("s{:02d}: {:.2f} s".format(i + 1, durs["s{:02d}".format(i + 1)]), flush=True)
    with open(os.path.join(AUDIO, "durations.json"), "w", encoding="utf-8") as fh:
        json.dump(durs, fh, indent=2)
    print("total narration: {:.1f} s".format(sum(durs.values())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
