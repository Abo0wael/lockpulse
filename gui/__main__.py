"""python -m gui  ->  streamlit run gui/app.py with the LockPulse dark theme (opens the browser)."""
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent / "app.py"
THEME = ["--theme.base", "dark", "--theme.backgroundColor", "#0d1117", "--theme.secondaryBackgroundColor", "#161b22",
         "--theme.textColor", "#e6edf3", "--theme.primaryColor", "#3fb950", "--browser.gatherUsageStats", "false"]


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    cmd = [sys.executable, "-m", "streamlit", "run", str(APP)] + THEME + list(argv)
    return subprocess.call(cmd, cwd=str(APP.parent.parent))


if __name__ == "__main__":
    sys.exit(main())
