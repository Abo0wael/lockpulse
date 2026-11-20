"""LockPulse Explorer - a read-only GUI over the real LockPulse data.

Launch: python -m gui   (or: streamlit run gui/app.py)
Deep links: ?page=replay&run=<run_id>&t=<ms>   (page: idea, replay, compare, syscall, overhead)
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import plotly.graph_objects as go  # noqa: E402
import streamlit as st  # noqa: E402
from plotly.subplots import make_subplots  # noqa: E402

from gui import data as D  # noqa: E402

BG, PANEL, LINE, FG, MUTED = "#0d1117", "#161b22", "#30363d", "#e6edf3", "#8b949e"
GREEN, RED, BLUE, AMBER, PURPLE, GRAY = "#3fb950", "#f85149", "#58a6ff", "#d29922", "#bc8cff", "#6e7681"
COLORS = {"green": GREEN, "red": RED, "blue": BLUE, "amber": AMBER}
DET_COLORS = {"B1": "#9e9e9e", "B2": BLUE, "B3": PURPLE, "B4": "#c9d1d9", "M1": AMBER, "M2": GREEN, "M3": RED}
PAGES = {"idea": "1 · The idea", "replay": "2 · Replay a run", "compare": "3 · Compare detectors",
         "syscall": "4 · Why the syscall matters", "overhead": "5 · Overhead"}
DEFAULT_RUN = "dining_philosophers-c1-s01"
SYSCALL_DEMO = ("sleeping_workers-c2-s06", "sem_never_posted-c1-s01")

st.set_page_config(page_title="LockPulse Explorer", page_icon="⏱", layout="wide")
st.markdown("""<style>
.block-container {padding-top: 1.6rem; padding-bottom: 1rem;}
.lp-card {border: 1px solid #30363d; border-left: 5px solid var(--c); border-radius: 8px; padding: 6px 10px;
          margin-bottom: 6px; background: #161b22; font-size: 0.86rem; line-height: 1.25;}
.lp-card b {color: var(--c);}
.lp-muted {color: #8b949e; font-size: 0.85rem;}
.lp-pill {display:inline-block; padding: 1px 9px; border-radius: 10px; font-weight: 600; font-size: 0.85rem;}
</style>""", unsafe_allow_html=True)


# ------------------------------------------------------------------ cached data

@st.cache_resource(show_spinner="Loading the frozen detectors ...")
def frozen():
    return D.frozen()


@st.cache_data(show_spinner=False)
def labels():
    return D.labels()


@st.cache_data(show_spinner="Loading run ...", max_entries=24)
def run_data(run_id):
    settings, models = frozen()
    return D.run_data(run_id, settings, models)


@st.cache_data(show_spinner=False)
def result_table(split):
    return D.result_table(split)


# ------------------------------------------------------------------ helpers

def qp(name, default=None):
    v = st.query_params.get(name)
    return v if v not in (None, "") else default


def truth_text(r):
    if r["truth"] == "healthy":
        return "healthy"
    if r["truth"] == "ambiguous":
        return "ambiguous (excluded)"
    return "{} · t0 = {:.0f} ms".format(r["truth"], r["t0_ms"]) if r["t0_ms"] == r["t0_ms"] else r["truth"]


def state_matrix(rd, hide_syscall=False):
    s = rd["state"].copy()
    if hide_syscall:
        s[(s == 1) | (s == 2)] = 3   # futex and sleep/IO both become "blocked"
    return s


def timeline_figure(rd, cursor_ms=None, hide_syscall=False, height=640, show_alert_row=True):
    """Thread timeline + M3 score + B2 silence + first alerts, on one time axis."""
    t = rd["t_ms"]
    tids = [str(x) for x in rd["tids"]]
    st_m = state_matrix(rd, hide_syscall)
    rows = 4 if show_alert_row else 3
    n = len(tids)
    heights = [max(0.28, min(0.5, 0.045 * n + 0.1)), 0.2, 0.2] + ([0.22] if show_alert_row else [])
    fig = make_subplots(rows=rows, cols=1, shared_xaxes=True, vertical_spacing=0.035, row_heights=heights,
                        subplot_titles=("threads (what each one is doing)", "M3 score (gradient boosting)",
                                        "B2: every thread silent in futex (ms)") + (("first alert",) if show_alert_row else ()))
    if hide_syscall:
        names = np.vectorize(lambda c: {-1: "not alive", 0: "running"}.get(int(c), "blocked"))(st_m)
        scale = [[0, BG], [0.2, BG], [0.2, GREEN], [0.4, GREEN], [0.4, GRAY], [1, GRAY]]
    else:
        sc = rd["syscall"]
        names = np.empty(st_m.shape, dtype=object)
        for (i, j), c in np.ndenumerate(st_m):
            names[i, j] = "not alive" if c < 0 else "{} · {}".format(D.STATE_NAMES[int(c)], D.syscall_name(sc[i, j])
                                                                    if sc[i, j] == sc[i, j] else "?")
        scale = [[0, BG], [0.2, BG], [0.2, GREEN], [0.4, GREEN], [0.4, RED], [0.6, RED], [0.6, BLUE], [0.8, BLUE],
                 [0.8, GRAY], [1, GRAY]]
    fig.add_trace(go.Heatmap(z=st_m.T, x=t, y=tids, zmin=-1, zmax=3, colorscale=scale, showscale=False,
                             text=names.T, hovertemplate="thread %{y}<br>%{x:.0f} ms<br>%{text}<extra></extra>"),
                  row=1, col=1)
    th = rd["thresholds"]
    fig.add_trace(go.Scatter(x=t, y=rd["scores"]["M3"], mode="lines", line=dict(color=RED, width=1.6), name="M3 score",
                             hovertemplate="%{x:.0f} ms: M3 %{y:.3f}<extra></extra>", showlegend=False), row=2, col=1)
    fig.add_hline(y=th["M3"], line=dict(color=RED, dash="dot", width=1), row=2, col=1,
                  annotation_text="threshold {:.6g}".format(th["M3"]), annotation_font_color=MUTED,
                  annotation_position="top left")
    fig.add_trace(go.Scatter(x=t, y=rd["scores"]["B2"], mode="lines", line=dict(color=BLUE, width=1.6),
                             hovertemplate="%{x:.0f} ms: silence %{y:.0f} ms<extra></extra>", showlegend=False),
                  row=3, col=1)
    fig.add_hline(y=th["B2"], line=dict(color=BLUE, dash="dot", width=1), row=3, col=1,
                  annotation_text="T = {:.0f} ms".format(th["B2"]), annotation_font_color=MUTED,
                  annotation_position="top left")
    if show_alert_row:
        # invisible points so every detector gets its own row, alerted or not
        fig.add_trace(go.Scatter(x=[float(t[0])] * len(D.DETECTORS), y=list(D.DETECTORS), mode="markers",
                                 marker=dict(opacity=0), hoverinfo="skip", showlegend=False), row=4, col=1)
        never = []
        for d in D.DETECTORS:
            a = rd["alerts"].get(d)
            if a is None:
                never.append(d)
                continue
            x = (a - rd["start"]) / 1e6
            kind, delay = rd["outcomes"][d]
            tip = "{}<br>first alert {:.0f} ms<br>{}".format(D.DETECTOR_NAMES[d], x, kind.replace("_", " ") + (
                "" if delay is None else " · delay {:+.1f} ms".format(delay)))
            fig.add_trace(go.Scatter(x=[x], y=[d], mode="markers+text", text=[d], textposition="middle right",
                                     marker=dict(color=DET_COLORS[d], size=12, symbol="diamond"), hovertext=[tip],
                                     hoverinfo="text", showlegend=False, textfont=dict(color=FG, size=10)),
                          row=4, col=1)
        fig.update_yaxes(categoryorder="array", categoryarray=list(reversed(D.DETECTORS)), tickmode="array",
                         tickvals=list(D.DETECTORS), tickfont=dict(size=10), row=4, col=1)
        if never:
            fig.add_annotation(text="no alert: " + ", ".join(never), xref="paper", yref="paper", x=1.0, y=0.0,
                               xanchor="right", yanchor="bottom", showarrow=False, font=dict(color=MUTED, size=11))
    if rd["t0"] is not None:
        t0 = (rd["t0"] - rd["start"]) / 1e6
        fig.add_vline(x=t0, line=dict(color=FG, dash="dash", width=1.4), row="all", col=1)
        fig.add_annotation(text=" t0 ", x=t0, y=1.0, xref="x", yref="y domain", showarrow=False,
                           font=dict(color=BG, size=11), bgcolor=FG, xanchor="center", yanchor="top")
    if cursor_ms is not None:
        fig.add_vline(x=cursor_ms, line=dict(color=AMBER, width=2), row="all", col=1)
    fig.update_layout(height=height, template="plotly_dark", paper_bgcolor=BG, plot_bgcolor=PANEL,
                      margin=dict(l=10, r=10, t=36, b=10), font=dict(color=FG), hovermode="closest")
    fig.update_xaxes(gridcolor=LINE, range=[float(t[0]), float(t[-1])])
    fig.update_xaxes(title_text="ms since the first sample", row=rows, col=1)
    fig.update_yaxes(gridcolor=LINE)
    fig.update_yaxes(title_text="tid", row=1, col=1, type="category")
    for a in fig.layout.annotations[:rows]:
        a.font = dict(color=MUTED, size=12)
        a.x = 0.0
        a.xanchor = "left"
    return fig


def legend_html(hide_syscall=False):
    items = [("running", GREEN)] + ([("blocked (futex or sleep/IO - can't tell)", GRAY)] if hide_syscall else
                                    [("blocked in futex", RED), ("sleep / IO (read, poll, nanosleep ...)", BLUE),
                                     ("other blocked", GRAY)])
    return " ".join('<span class="lp-pill" style="background:{}33;border:1px solid {};color:{}">{}</span>'.format(
        c, c, FG, n) for n, c in items)


def detector_cards(rd, cursor_ms):
    out = []
    end_ms = float(rd["t_ms"][-1])
    for d in D.DETECTORS:
        a = rd["alerts"].get(d)
        kind, delay = rd["outcomes"][d]
        col = DET_COLORS[d]
        if a is not None and (a - rd["start"]) / 1e6 <= cursor_ms:
            x = (a - rd["start"]) / 1e6
            if kind == "detected":
                verdict = "delay {:+.1f} ms vs t0".format(delay)
            elif kind == "fa_early":
                verdict = "<span style='color:{}'>false alarm: before t0</span>".format(RED)
            else:
                verdict = "<span style='color:{}'>false alarm: run is healthy</span>".format(RED)
            body = "<b>ALERT</b> at {:.0f} ms · {}".format(x, verdict)
        elif a is None and cursor_ms >= end_ms - 1:
            body = "no alert" + (" <span style='color:{}'>(missed the hang)</span>".format(RED) if rd["hang"] else
                                 " <span style='color:{}'>(correct)</span>".format(GREEN))
        else:
            body = "<span class='lp-muted'>waiting ...</span>"
        out.append('<div class="lp-card" style="--c:{}"><b>{}</b> {}<br>{}</div>'.format(
            col, d, D.DETECTOR_NAMES[d][3:], body))
    st.markdown("".join(out), unsafe_allow_html=True)


# ------------------------------------------------------------------ sidebar

lab = labels()
lab["t0_ms"] = np.nan
st.sidebar.markdown("## ⏱ LockPulse Explorer")
page_keys = list(PAGES)
page = st.sidebar.radio("Page", page_keys, format_func=PAGES.get,
                        index=page_keys.index(qp("page", "replay")) if qp("page", "replay") in PAGES else 1)

st.sidebar.markdown("### Run")
want = qp("run", DEFAULT_RUN)
if want not in set(lab["run_id"]):
    want = DEFAULT_RUN
wrow = lab[lab["run_id"] == want].iloc[0]
splits = ["test", "validation", "train"]
split = st.sidebar.selectbox("Split", splits, index=splits.index(wrow["split"]), key="split")
fams = sorted(lab.loc[lab["split"] == split, "family"].unique())
fam = st.sidebar.selectbox("Family", fams, index=fams.index(wrow["family"]) if wrow["family"] in fams else 0,
                           key="family_" + split)
runs = lab[(lab["split"] == split) & (lab["family"] == fam)]
ids = list(runs["run_id"])
truth_of = dict(zip(runs["run_id"], runs["truth"]))
run_id = st.sidebar.selectbox("Run", ids, index=ids.index(want) if want in ids else 0,
                              format_func=lambda r: "{}  ·  {}".format(r, truth_of[r]), key="run_" + fam)
rd = run_data(run_id)
row = lab[lab["run_id"] == run_id].iloc[0].copy()
row["t0_ms"] = (rd["t0"] - rd["start"]) / 1e6 if rd["t0"] is not None else np.nan
col = {"healthy": GREEN, "deadlock": RED, "hang": AMBER}.get(row["truth"], MUTED)
st.sidebar.markdown('<span class="lp-pill" style="background:{0}33;border:1px solid {0};color:{1}">{2}</span>'.format(
    col, FG, truth_text(row)), unsafe_allow_html=True)
st.sidebar.caption("config {} · seed {} · exit: {}".format(row["config_id"], row["seed"], row["exit_reason"]))
st.sidebar.markdown("---")
st.sidebar.caption("Read-only: data/collect1, the frozen phase-3 detectors (hashes verified) and results/. "
                   "Nothing is trained or tuned here.")
st.query_params.update({"page": page, "run": run_id})


# ------------------------------------------------------------------ page 1

def page_idea():
    st.title("LockPulse: spotting hung programs from the outside")
    a, b = st.columns([1.15, 1])
    with a:
        st.markdown(
            "**The problem.** A multithreaded C program can *hang*: a deadlock (two threads each waiting for a "
            "lock the other holds), a lost wake-up, a barrier missing a thread, a semaphore nobody posts. "
            "No crash, no error - it just stops.\n\n"
            "**Existing approaches.** A *timeout* waits seconds and false-alarms when threads simply sleep or wait "
            "for I/O. A *wait-for graph* must instrument every lock, and is blind to hangs without a lock cycle.\n\n"
            "**Our approach.** Watch the program from outside: every 5 ms read `/proc` for each thread - state, CPU "
            "time, context switches and the **system call it is blocked in** (Tier P). Rules and ML models decide from "
            "that alone. A full `LD_PRELOAD` trace of every lock, condvar, semaphore and barrier call (Tier F) is "
            "recorded only to know the truth and to grade the detectors.")
        st.info("On 180 unseen test runs, B2 (every thread silent in futex), M2 and M3 caught all 91 hangs in about "
                "50-70 ms with zero false alarms. The honest result: the simple rule matches the ML models.")
    with b:
        st.graphviz_chart("""
digraph G { bgcolor="transparent"; rankdir=LR; nodesep=0.5;
 node [fontname="Helvetica", fontsize=12, style="filled,rounded", shape=box, fillcolor="#161b22",
       fontcolor="#e6edf3", color="#30363d", penwidth=2];
 edge [color="#8b949e", fontcolor="#8b949e", fontname="Helvetica", fontsize=10];
 prog [label="C program\\n(unmodified)", color="#e6edf3"];
 p [label="Tier P\\n/proc sampler\\nevery 5 ms", color="#3fb950"];
 f [label="Tier F\\nLD_PRELOAD shim\\nevery sync call", color="#58a6ff"];
 det [label="detector\\nrules + ML -> alert", color="#3fb950"];
 gt [label="ground truth\\nt0, deadlock?\\n+ baselines B3/B4", color="#58a6ff"];
 prog -> p; p -> det [label="only input"]; prog -> f; f -> gt [label="labels / grading"];
}""", width="stretch")


# ------------------------------------------------------------------ page 2

def page_replay():
    t_ms = rd["t_ms"]
    end = float(t_ms[-1])
    if st.session_state.get("cursor_run") != run_id:
        st.session_state["cursor_run"] = run_id
        st.session_state["playing"] = False
        default = (rd["t0"] - rd["start"]) / 1e6 + 300 if rd["t0"] is not None else 0.6 * end
        st.session_state["cursor"] = float(min(end, float(qp("t", default))))
    if "pending_cursor" in st.session_state:          # set by the play loop on the previous run
        st.session_state["cursor"] = st.session_state.pop("pending_cursor")
    st.title("Replay a run")
    st.markdown("**{}** · {} split · {}".format(run_id, rd["split"], truth_text(row)))
    c1, c2, c3 = st.columns([0.9, 1.6, 6])
    with c1:
        if st.button("⏸ Pause" if st.session_state.get("playing") else "▶ Play", width="stretch"):
            st.session_state["playing"] = not st.session_state.get("playing", False)
            if st.session_state["playing"] and st.session_state["cursor"] >= end - 1:
                st.session_state["cursor"] = 0.0
    with c2:
        speed = st.radio("speed", ["1x", "2x", "4x"], horizontal=True, label_visibility="collapsed", key="speed")
    with c3:
        st.slider("time (ms since the first sample)", 0.0, end, key="cursor", step=float(rd["tick_ms"]),
                  label_visibility="collapsed")
    cursor = float(st.session_state["cursor"])
    i = D.tick_index(rd, cursor)

    left, right = st.columns([3.1, 1.25])
    with left:
        st.markdown(legend_html(), unsafe_allow_html=True)
        st.plotly_chart(timeline_figure(rd, cursor), width="stretch", key="tl")
    with right:
        live = rd["state"][i] >= 0
        st.markdown("**At {:.0f} ms** · {} of {} live threads in futex".format(
            t_ms[i], int(rd["futex_count"][i]), int(live.sum())))
        thr = pd.DataFrame({"tid": [t for t, l in zip(rd["tids"], live) if l],
                            "state": [D.STATE_NAMES[int(c)] for c in rd["state"][i] if c >= 0],
                            "syscall": [D.syscall_name(s) if s == s else "?" for s, l in zip(rd["syscall"][i], live) if l]})
        st.dataframe(thr, hide_index=True, width="stretch", height=min(38 + 35 * len(thr), 260))
        detector_cards(rd, cursor)

    st.markdown("#### Tier F at the cursor (ground-truth trace, not seen by the Tier P detectors)")
    f1, f2 = st.columns([1.3, 1])
    until = rd["start"] + int(cursor * 1e6)
    tf = rd["tierf"]
    with f1:
        last = tf[tf["ts_ns"] <= until].tail(12).copy()
        last.insert(0, "t (ms)", ((last["ts_ns"] - rd["start"]) / 1e6).round(2))
        st.dataframe(last[["t (ms)", "tid", "event", "obj_addr"]], hide_index=True, width="stretch",
                     height=38 + 35 * 12)
    with f2:
        owner, pending, cycle = D.tierf_state(tf, until)
        st.markdown("**Wait-for graph** " + ("<span style='color:{}'>· cycle: threads {}</span>".format(
            RED, " → ".join(str(t) for t in cycle + cycle[:1])) if cycle else "<span class='lp-muted'>· no cycle</span>"),
            unsafe_allow_html=True)
        st.graphviz_chart(D.wait_for_dot(owner, pending, cycle, COLORS), width="stretch")

    if st.session_state.get("playing"):
        step = {"1x": 1, "2x": 2, "4x": 4}[speed] * 150.0
        time.sleep(0.15)
        nxt = cursor + step
        if nxt >= end:
            nxt, st.session_state["playing"] = end, False
        st.session_state["pending_cursor"] = nxt
        st.rerun()


# ------------------------------------------------------------------ page 3

def page_compare():
    st.title("Compare detectors")
    split = st.radio("split", ["test", "validation"], horizontal=True, key="cmp_split")
    t = result_table(split)
    if split == "test":
        st.caption("Test numbers come from the one-shot evaluation of the frozen detectors "
                   "(results/phase4/test_table.csv; settings frozen before any test run).")
    else:
        st.caption("Validation is where every threshold, window and hyperparameter was chosen "
                   "(results/phase3/validation_table.csv).")
    ov = t[t["scope"] == "overall"].set_index("det").loc[D.DETECTORS].reset_index()
    a, b = st.columns(2)
    with a:
        fig = go.Figure()
        for name, colm, c in (("median", "delay_median_ms", GREEN), ("p90", "delay_p90_ms", AMBER)):
            y = ov[colm].clip(lower=0.01)
            fig.add_bar(x=ov["det"], y=y, name=name, marker_color=c,
                        customdata=np.stack([ov[colm], ov["detected"], ov["hang_runs"], ov["fa_healthy"] + ov["fa_early"],
                                             ov["delay_p90_ms"]], axis=1),
                        hovertemplate="%{x}<br>" + name + " delay %{customdata[0]:.2f} ms<br>detected %{customdata[1]}"
                                      "/%{customdata[2]}<br>false alarms %{customdata[3]}<br>p90 %{customdata[4]:.1f} ms"
                                      "<extra></extra>")
        fig.update_layout(title="Detection delay (log scale; B3 ~0 ms drawn at 0.01)", yaxis_type="log",
                          barmode="group", yaxis_title="ms")
        st.plotly_chart(style(fig), width="stretch")
    with b:
        fig = go.Figure(go.Bar(x=ov["det"], y=ov["pr_auc"].fillna(0), marker_color=[DET_COLORS[d] for d in ov["det"]],
                               text=[("n/a" if v != v else "{:.3f}".format(v)) for v in ov["pr_auc"]],
                               textposition="outside",
                               hovertemplate="%{x}: PR-AUC %{text}<extra></extra>"))
        fig.update_layout(title="Window-level PR-AUC (n/a: no continuous Tier P score)", yaxis_range=[0, 1.08])
        st.plotly_chart(style(fig), width="stretch")
    fam = t[t["scope"] != "overall"]
    c, d = st.columns(2)
    with c:
        h = fam[fam["hang_runs"] > 0]
        fig = go.Figure()
        for det in D.DETECTORS:
            r = h[h["det"] == det]
            fig.add_bar(x=r["scope"], y=r["detection_rate"], name=det, marker_color=DET_COLORS[det],
                        customdata=np.stack([r["detected"], r["hang_runs"], r["delay_median_ms"]], axis=1),
                        hovertemplate=det + " · %{x}<br>detected %{customdata[0]}/%{customdata[1]}"
                                      "<br>median delay %{customdata[2]:.1f} ms<extra></extra>")
        fig.update_layout(title="Detected hangs per family", barmode="group", yaxis_tickformat=".0%",
                          yaxis_range=[0, 1.05])
        st.plotly_chart(style(fig), width="stretch")
    with d:
        fig = go.Figure()
        for det in D.DETECTORS:
            r = fam[fam["det"] == det]
            fig.add_bar(x=r["scope"], y=r["fa_healthy"] + r["fa_early"], name=det, marker_color=DET_COLORS[det],
                        customdata=np.stack([r["fa_healthy"], r["fa_early"], r["runs"]], axis=1),
                        hovertemplate=det + " · %{x}<br>healthy runs alerted %{customdata[0]}<br>early alerts "
                                      "%{customdata[1]}<br>of %{customdata[2]} runs<extra></extra>")
        fig.update_layout(title="False alarms per family", barmode="group")
        st.plotly_chart(style(fig), width="stretch")
    with st.expander("Full table"):
        st.dataframe(t.drop(columns=["det"]), hide_index=True, width="stretch")


def style(fig, height=380):
    fig.update_layout(template="plotly_dark", paper_bgcolor=BG, plot_bgcolor=PANEL, height=height,
                      margin=dict(l=10, r=10, t=50, b=10), font=dict(color=FG), legend=dict(orientation="h", y=-0.15))
    fig.update_xaxes(gridcolor=LINE)
    fig.update_yaxes(gridcolor=LINE)
    return fig


# ------------------------------------------------------------------ page 4

def page_syscall():
    st.title("Why the syscall matters")
    st.markdown("A sleeping workload and a real hang look **identical** from `/proc` if you only look at thread state "
                "(everyone is in state S, no CPU). The syscall a thread is blocked in tells them apart: "
                "`futex` = waiting for a lock / condvar / semaphore, `read` / `nanosleep` = waiting for I/O or time.")
    hide = st.toggle("hide syscall (what a detector without /proc/<tid>/syscall would see)", key="hide_sc")
    st.markdown(legend_html(hide), unsafe_allow_html=True)
    cols = st.columns(2)
    for c, rid in zip(cols, SYSCALL_DEMO):
        r = run_data(rid)
        lr = lab[lab["run_id"] == rid].iloc[0].copy()
        lr["t0_ms"] = (r["t0"] - r["start"]) / 1e6 if r["t0"] is not None else np.nan
        with c:
            st.markdown("**{}** · {} split · {}".format(rid, r["split"], truth_text(lr)))
            st.plotly_chart(timeline_figure(r, None, hide_syscall=hide, height=520), width="stretch",
                            key="sc_" + rid)
    st.markdown("#### Ablation: retrain without the syscall features (choices on validation, numbers on test)")
    ab = D.ablation_table()
    ab = ab[ab["ablation"] == "features"][["detector", "variant", "setting", "detected", "hang_runs",
                                           "delay_median_ms", "fa_healthy", "fa_early", "test_pr_auc"]]
    ab["detected"] = ab["detected"].astype(str) + " / " + ab["hang_runs"].astype(str)
    st.dataframe(ab.drop(columns=["hang_runs"]), hide_index=True, width="stretch")
    st.caption("Without syscall features (or with only state + CPU), M2 and M3 detect 0 / 91 test hangs: on validation, "
               "every threshold that catches hangs also flags the sleeping_workers runs, so the 5 % false-alarm rule "
               "leaves a threshold that never fires.")


# ------------------------------------------------------------------ page 5

def page_overhead():
    st.title("Overhead of each telemetry tier")
    st.caption("Fixed-work runs (same number of lock operations in every mode), 10 repetitions per mode, from the "
               "collect workflow's overhead job (results/phase4/overhead_*.csv). No new runs.")
    summ, runs = D.overhead()
    fams = list(dict.fromkeys(summ["family"]))
    cols = st.columns(len(fams))
    modes = ["untraced", "P", "F", "PF"]
    names = {"untraced": "untraced", "P": "Tier P (/proc)", "F": "Tier F (shim)", "PF": "both"}
    mcol = {"untraced": MUTED, "P": GREEN, "F": BLUE, "PF": PURPLE}
    for c, fam in zip(cols, fams):
        base = summ[(summ["family"] == fam) & (summ["mode"] == "untraced")]["bench_ms_median"].iloc[0]
        r = runs[runs["family"] == fam]
        ys, lo, hi, cpu = [], [], [], []
        for m in modes:
            b = r[r["mode"] == m]["bench_ms"] / base
            ys.append(b.median())
            lo.append(b.median() - b.quantile(0.25))
            hi.append(b.quantile(0.75) - b.median())
            cpu.append(summ[(summ["family"] == fam) & (summ["mode"] == m)]["cpu_median"].iloc[0])
        fig = go.Figure(go.Bar(x=[names[m] for m in modes], y=ys, marker_color=[mcol[m] for m in modes],
                               error_y=dict(type="data", symmetric=False, array=hi, arrayminus=lo, color=FG),
                               text=["{:.2f}x".format(v) for v in ys], textposition="inside",
                               insidetextanchor="start", textfont=dict(color=BG, size=13),
                               customdata=np.stack([np.array(lo), np.array(hi), np.nan_to_num(np.array(cpu, dtype=float),
                                                                                              nan=-1)], axis=1),
                               hovertemplate="%{x}<br>slowdown %{y:.3f}x<br>IQR -%{customdata[0]:.3f} / "
                                             "+%{customdata[1]:.3f}<br>launcher CPU %{customdata[2]:.1f} %"
                                             "<extra></extra>"))
        fig.add_hline(y=1.0, line=dict(color=MUTED, dash="dot"))
        fig.update_layout(title=fam, yaxis_title="slowdown vs untraced (median, IQR bars)",
                          yaxis_range=[0, max(np.array(ys) + np.array(hi)) * 1.2])
        with c:
            st.plotly_chart(style(fig, 420), width="stretch")
    st.dataframe(summ[["family", "mode", "n", "bench_ms_median", "bench_ms_iqr", "slowdown_vs_untraced",
                       "ops_per_s_median", "cpu_median"]].rename(columns={"cpu_median": "launcher CPU % (median)"}),
                 hide_index=True, width="stretch")
    st.caption("high_contention's untraced IQR (7.9 ms on a 30.7 ms median) is about as large as Tier P's 15 % "
               "slowdown there; launcher CPU = the sampler (P, PF) or only the watchdog (F).")


{"idea": page_idea, "replay": page_replay, "compare": page_compare, "syscall": page_syscall,
 "overhead": page_overhead}[page]()
