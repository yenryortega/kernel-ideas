"""Kernel Ideas — personal idea-card app (Flask + PostgreSQL).

Env vars:
  DATABASE_URL   PostgreSQL URL (Railway sets it). Falls back to local SQLite.
  SECRET_KEY     Random string for session cookies.
  APP_PASSWORD   Your login password.
"""
import json
import os
import random
import re
from datetime import date, datetime, timedelta
from functools import wraps

from flask import Flask, jsonify, render_template, request, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

from content import SOURCES

TOPICS = ["habits", "focus", "mindset", "learning", "money", "people",
          "health", "decisions", "creativity", "leadership", "calm", "career"]
KINDS = ["book", "article", "podcast", "video"]
BOARD_COLORS = ["#1d4f86", "#1f6b4a", "#5b3a8c", "#b2442f", "#12707a", "#a1307a", "#8a5d07", "#3c4a9e"]

app = Flask(__name__)
db_url = os.environ.get("DATABASE_URL", "sqlite:///kernel.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config.update(
    SQLALCHEMY_DATABASE_URI=db_url,
    SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
    SECRET_KEY=os.environ.get("SECRET_KEY", "dev-only-change-me"),
    PERMANENT_SESSION_LIFETIME=timedelta(days=365),
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("RAILWAY_ENVIRONMENT") is not None,
)
db = SQLAlchemy(app)


# ───────────────────────── models ─────────────────────────
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Source(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(160), unique=True, nullable=False)
    kind = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(200))
    topic = db.Column(db.String(30), nullable=False)
    url = db.Column(db.String(400))
    blurb = db.Column(db.String(400))
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"))  # null = curated
    ideas = db.relationship("Idea", backref="source", order_by="Idea.position")


class Idea(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(200), unique=True, nullable=False)
    source_id = db.Column(db.Integer, db.ForeignKey("source.id"), nullable=False)
    position = db.Column(db.Integer, default=0)
    topic = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.String(400))
    bullets = db.Column(db.Text, default="[]")  # JSON list
    action = db.Column(db.String(400))
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ReadLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    idea_id = db.Column(db.Integer, db.ForeignKey("idea.id"), nullable=False)
    day = db.Column(db.String(10), nullable=False)  # user's local date YYYY-MM-DD
    read_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "idea_id"),)


class Board(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name = db.Column(db.String(80), nullable=False)
    color = db.Column(db.String(9), default="#1d4f86")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class BoardItem(db.Model):
    board_id = db.Column(db.Integer, db.ForeignKey("board.id", ondelete="CASCADE"), primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey("idea.id", ondelete="CASCADE"), primary_key=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)


# ───────────────────────── setup ─────────────────────────
def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:150]


def sync_content():
    """Insert or update curated sources and ideas from content.py."""
    for s in SOURCES:
        slug = slugify(s["title"])
        src = Source.query.filter_by(slug=slug).first() or Source(slug=slug)
        for k in ("kind", "title", "author", "topic", "url", "blurb"):
            setattr(src, k, s[k])
        db.session.add(src)
        db.session.flush()
        for pos, it in enumerate(s["ideas"]):
            islug = f"{slug}--{slugify(it['title'])}"
            idea = Idea.query.filter_by(slug=islug).first() or Idea(slug=islug)
            idea.source_id, idea.position, idea.topic = src.id, pos, s["topic"]
            idea.title, idea.summary, idea.action = it["title"], it["summary"], it["action"]
            idea.bullets = json.dumps(it["bullets"])
            db.session.add(idea)
    db.session.commit()


def ensure_owner():
    pw = os.environ.get("APP_PASSWORD", "kernel")
    user = User.query.filter_by(username="me").first()
    if not user:
        user = User(username="me", password_hash=generate_password_hash(pw))
        db.session.add(user)
        db.session.flush()
        db.session.add(Board(user_id=user.id, name="Saved", color=BOARD_COLORS[0]))
    elif not check_password_hash(user.password_hash, pw):
        user.password_hash = generate_password_hash(pw)
    db.session.commit()


with app.app_context():
    db.create_all()
    sync_content()
    ensure_owner()


# ───────────────────────── helpers ─────────────────────────
def login_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if not session.get("uid"):
            return jsonify(error="Please log in."), 401
        return f(*a, **kw)
    return wrapper


def uid():
    return session["uid"]


def saved_ids(user_id):
    rows = db.session.query(BoardItem.idea_id).join(Board).filter(Board.user_id == user_id).all()
    return {r[0] for r in rows}


def read_ids(user_id):
    return {r[0] for r in db.session.query(ReadLog.idea_id).filter_by(user_id=user_id).all()}


def visible_ideas(user_id):
    return Idea.query.filter((Idea.created_by.is_(None)) | (Idea.created_by == user_id))


def idea_json(i, saved=None, read=None):
    s = i.source
    return dict(
        id=i.id, title=i.title, summary=i.summary, bullets=json.loads(i.bullets or "[]"),
        action=i.action, topic=i.topic, position=i.position,
        source=dict(id=s.id, kind=s.kind, title=s.title, author=s.author, url=s.url, count=len(s.ideas)),
        own=i.created_by is not None,
        saved=(i.id in saved) if saved is not None else None,
        read=(i.id in read) if read is not None else None,
    )


def source_json(s, read=None):
    return dict(id=s.id, kind=s.kind, title=s.title, author=s.author, topic=s.topic,
                url=s.url, blurb=s.blurb, count=len(s.ideas),
                read=sum(1 for i in s.ideas if read and i.id in read))


def body():
    return request.get_json(silent=True) or {}


# ───────────────────────── pages ─────────────────────────
@app.get("/")
def index():
    return render_template("index.html")


@app.get("/sw.js")
def service_worker():
    resp = send_from_directory("static", "sw.js")
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["Service-Worker-Allowed"] = "/"
    return resp


@app.get("/manifest.webmanifest")
def manifest():
    return send_from_directory("static", "manifest.webmanifest", mimetype="application/manifest+json")


@app.get("/health")
def health():
    return "ok"


# ───────────────────────── auth ─────────────────────────
@app.post("/api/login")
def login():
    user = User.query.filter_by(username="me").first()
    if user and check_password_hash(user.password_hash, body().get("password", "")):
        session.permanent = True
        session["uid"] = user.id
        return jsonify(ok=True)
    return jsonify(error="Wrong password. Try again."), 401


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def me():
    return jsonify(logged_in=bool(session.get("uid")))


# ───────────────────────── content ─────────────────────────
@app.get("/api/feed")
@login_required
def feed():
    topic, kind = request.args.get("topic"), request.args.get("kind")
    q = visible_ideas(uid()).join(Source)
    if topic in TOPICS:
        q = q.filter(Idea.topic == topic)
    if kind in KINDS:
        q = q.filter(Source.kind == kind)
    ideas = q.all()
    rd, sv = read_ids(uid()), saved_ids(uid())
    unread = [i for i in ideas if i.id not in rd]
    seen = [i for i in ideas if i.id in rd]
    random.shuffle(unread)
    random.shuffle(seen)
    return jsonify(ideas=[idea_json(i, sv, rd) for i in unread + seen])


@app.get("/api/ideas/<int:iid>")
@login_required
def get_idea(iid):
    i = visible_ideas(uid()).filter(Idea.id == iid).first_or_404()
    return jsonify(idea_json(i, saved_ids(uid()), read_ids(uid())))


@app.post("/api/ideas/<int:iid>/read")
@login_required
def mark_read(iid):
    day = body().get("day") or date.today().isoformat()
    if not ReadLog.query.filter_by(user_id=uid(), idea_id=iid).first():
        db.session.add(ReadLog(user_id=uid(), idea_id=iid, day=day[:10]))
        db.session.commit()
    return jsonify(ok=True)


@app.get("/api/sources")
@login_required
def sources():
    rd = read_ids(uid())
    q = Source.query.filter((Source.created_by.is_(None)) | (Source.created_by == uid()))
    return jsonify(sources=[source_json(s, rd) for s in q.order_by(Source.title).all()])


@app.get("/api/sources/<int:sid>")
@login_required
def source_detail(sid):
    s = Source.query.get_or_404(sid)
    if s.created_by not in (None, uid()):
        return jsonify(error="Not found"), 404
    rd, sv = read_ids(uid()), saved_ids(uid())
    return jsonify(source=source_json(s, rd), ideas=[idea_json(i, sv, rd) for i in s.ideas])


@app.post("/api/ideas")
@login_required
def create_idea():
    d = body()
    title, summary = (d.get("title") or "").strip(), (d.get("summary") or "").strip()
    bullets = [b.strip() for b in (d.get("bullets") or []) if b and b.strip()][:6]
    topic = d.get("topic") if d.get("topic") in TOPICS else "focus"
    kind = d.get("kind") if d.get("kind") in KINDS else "book"
    stitle = (d.get("source_title") or "").strip() or "My notes"
    if not title or not (summary or bullets):
        return jsonify(error="Add a title and at least a summary or one bullet."), 400
    sslug = f"u{uid()}-{slugify(stitle)}"
    src = Source.query.filter_by(slug=sslug).first()
    if not src:
        src = Source(slug=sslug, kind=kind, title=stitle, author=(d.get("author") or "").strip() or None,
                     topic=topic, blurb="Your own notes.", created_by=uid())
        db.session.add(src)
        db.session.flush()
    idea = Idea(slug=f"{sslug}--{slugify(title)}-{int(datetime.utcnow().timestamp())}", source_id=src.id,
                position=len(src.ideas), topic=topic, title=title[:200], summary=summary[:400],
                bullets=json.dumps(bullets), action=(d.get("action") or "").strip()[:400] or None,
                created_by=uid())
    db.session.add(idea)
    db.session.commit()
    return jsonify(idea_json(idea, saved_ids(uid()), read_ids(uid()))), 201


@app.delete("/api/ideas/<int:iid>")
@login_required
def delete_idea(iid):
    i = Idea.query.filter_by(id=iid, created_by=uid()).first_or_404()
    BoardItem.query.filter_by(idea_id=iid).delete()
    ReadLog.query.filter_by(idea_id=iid).delete()
    db.session.delete(i)
    db.session.commit()
    return jsonify(ok=True)


# ───────────────────────── boards ─────────────────────────
def board_json(b, with_ideas=False):
    items = (db.session.query(Idea).join(BoardItem, BoardItem.idea_id == Idea.id)
             .filter(BoardItem.board_id == b.id).order_by(BoardItem.added_at.desc()).all())
    out = dict(id=b.id, name=b.name, color=b.color, count=len(items),
               preview=[dict(topic=i.topic, title=i.title) for i in items[:4]])
    if with_ideas:
        sv, rd = saved_ids(uid()), read_ids(uid())
        out["ideas"] = [idea_json(i, sv, rd) for i in items]
    return out


@app.get("/api/boards")
@login_required
def boards():
    idea_id = request.args.get("idea", type=int)
    bs = Board.query.filter_by(user_id=uid()).order_by(Board.created_at).all()
    out = [board_json(b) for b in bs]
    if idea_id:
        inb = {r[0] for r in db.session.query(BoardItem.board_id).filter_by(idea_id=idea_id).all()}
        for o in out:
            o["has_idea"] = o["id"] in inb
    return jsonify(boards=out, colors=BOARD_COLORS)


@app.post("/api/boards")
@login_required
def create_board():
    d = body()
    name = (d.get("name") or "").strip()[:80]
    if not name:
        return jsonify(error="Give the board a name."), 400
    color = d.get("color") if d.get("color") in BOARD_COLORS else random.choice(BOARD_COLORS)
    b = Board(user_id=uid(), name=name, color=color)
    db.session.add(b)
    db.session.commit()
    return jsonify(board_json(b)), 201


@app.get("/api/boards/<int:bid>")
@login_required
def get_board(bid):
    b = Board.query.filter_by(id=bid, user_id=uid()).first_or_404()
    return jsonify(board_json(b, with_ideas=True))


@app.patch("/api/boards/<int:bid>")
@login_required
def update_board(bid):
    b = Board.query.filter_by(id=bid, user_id=uid()).first_or_404()
    d = body()
    if (d.get("name") or "").strip():
        b.name = d["name"].strip()[:80]
    if d.get("color") in BOARD_COLORS:
        b.color = d["color"]
    db.session.commit()
    return jsonify(board_json(b))


@app.delete("/api/boards/<int:bid>")
@login_required
def delete_board(bid):
    b = Board.query.filter_by(id=bid, user_id=uid()).first_or_404()
    BoardItem.query.filter_by(board_id=b.id).delete()
    db.session.delete(b)
    db.session.commit()
    return jsonify(ok=True)


@app.post("/api/boards/<int:bid>/ideas")
@login_required
def add_to_board(bid):
    b = Board.query.filter_by(id=bid, user_id=uid()).first_or_404()
    iid = body().get("idea_id")
    if not visible_ideas(uid()).filter(Idea.id == iid).first():
        return jsonify(error="Idea not found"), 404
    if not BoardItem.query.get((b.id, iid)):
        db.session.add(BoardItem(board_id=b.id, idea_id=iid))
        db.session.commit()
    return jsonify(ok=True)


@app.delete("/api/boards/<int:bid>/ideas/<int:iid>")
@login_required
def remove_from_board(bid, iid):
    Board.query.filter_by(id=bid, user_id=uid()).first_or_404()
    BoardItem.query.filter_by(board_id=bid, idea_id=iid).delete()
    db.session.commit()
    return jsonify(ok=True)


# ───────────────────────── stats ─────────────────────────
@app.get("/api/stats")
@login_required
def stats():
    today = request.args.get("today") or date.today().isoformat()
    t = date.fromisoformat(today[:10])
    logs = ReadLog.query.filter_by(user_id=uid()).all()
    per_day = {}
    for l in logs:
        per_day[l.day] = per_day.get(l.day, 0) + 1
    # streak: consecutive days ending today (or yesterday if nothing yet today)
    streak, d = 0, t if per_day.get(t.isoformat()) else t - timedelta(days=1)
    while per_day.get(d.isoformat()):
        streak += 1
        d -= timedelta(days=1)
    best, run, prev = 0, 0, None
    for k in sorted(per_day):
        cur = date.fromisoformat(k)
        run = run + 1 if prev and cur - prev == timedelta(days=1) else 1
        best, prev = max(best, run), cur
    rd = {l.idea_id for l in logs}
    ideas = visible_ideas(uid()).all()
    by_topic = []
    for tp in TOPICS:
        pool = [i for i in ideas if i.topic == tp]
        by_topic.append(dict(topic=tp, total=len(pool), read=sum(1 for i in pool if i.id in rd)))
    days = [dict(day=(t - timedelta(days=n)).isoformat(),
                 count=per_day.get((t - timedelta(days=n)).isoformat(), 0)) for n in range(27, -1, -1)]
    return jsonify(today=per_day.get(t.isoformat(), 0), streak=streak, best_streak=best,
                   total_read=len(rd), total=len(ideas), saved=len(saved_ids(uid())),
                   days=days, by_topic=by_topic)


if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
