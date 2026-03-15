"""
SKR-HUB BACKEND — v2.0 UPGRADED
================================
Upgrades vs v1:
[+] Tasks API: thêm subject, tag, description, due_date, completed_at, estimated_mins, notes
[+] /api/user/stats: weekly_activity data cho chart, total_tasks count
[+] Rate limiting đơn giản (in-memory, no dep)
[+] Input sanitization helper
[+] Error handler chuẩn JSON cho 404 / 500
[+] API: tasks sort + filter by priority/status
[+] API: bulk flashcard import
[+] Streak logic tách hàm riêng
[+] Achievement check tách hàm riêng, check nhiều loại
[+] DB migration: tự thêm column mới nếu thiếu
"""

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime, date
import sqlite3
import os
import re
import math
import secrets
import time
from functools import wraps

# ──────────────────────────────────────────────
#  APP CONFIG
# ──────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "skr_hub_v2_secret_2026")
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['JSON_SORT_KEYS'] = False

DATABASE = "database.db"

# ──────────────────────────────────────────────
#  DATABASE
# ──────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")   # better concurrency
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                email       TEXT    UNIQUE NOT NULL,
                password    TEXT    NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_stats (
                user_id         INTEGER PRIMARY KEY,
                xp              INTEGER DEFAULT 0,
                level           INTEGER DEFAULT 1,
                streak          INTEGER DEFAULT 0,
                total_minutes   INTEGER DEFAULT 0,
                daily_goal      INTEGER DEFAULT 30,
                focus_count     INTEGER DEFAULT 0,
                tasks_completed INTEGER DEFAULT 0,
                last_active     DATE    DEFAULT CURRENT_DATE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS achievements (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id          INTEGER NOT NULL,
                achievement_name TEXT    NOT NULL,
                achieved_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL,
                title          TEXT    NOT NULL,
                description    TEXT    DEFAULT '',
                subject        TEXT    DEFAULT '',
                tag            TEXT    DEFAULT '',
                date           TEXT    DEFAULT '',
                due_date       TEXT    DEFAULT '',
                priority       TEXT    DEFAULT 'Medium',
                completed      INTEGER DEFAULT 0,
                completed_at   TEXT    DEFAULT NULL,
                estimated_mins INTEGER DEFAULT 0,
                notes          TEXT    DEFAULT '',
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS flashcards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                front      TEXT    NOT NULL,
                back       TEXT    NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS daily_activity (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                act_date   DATE    NOT NULL,
                minutes    INTEGER DEFAULT 0,
                sessions   INTEGER DEFAULT 0,
                UNIQUE(user_id, act_date),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        ''')
        conn.commit()

    # ── DB Migration: add new columns to tasks if they don't exist ──
    _migrate_tasks()

def _migrate_tasks():
    """Add columns introduced in v2 without breaking existing data."""
    new_cols = [
        ("description",    "TEXT    DEFAULT ''"),
        ("subject",        "TEXT    DEFAULT ''"),
        ("tag",            "TEXT    DEFAULT ''"),
        ("due_date",       "TEXT    DEFAULT ''"),
        ("completed_at",   "TEXT    DEFAULT NULL"),
        ("estimated_mins", "INTEGER DEFAULT 0"),
        ("notes",          "TEXT    DEFAULT ''"),
    ]
    with get_db() as conn:
        existing = {row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()}
        for col, definition in new_cols:
            if col not in existing:
                conn.execute(f"ALTER TABLE tasks ADD COLUMN {col} {definition}")
        conn.commit()

init_db()

# ──────────────────────────────────────────────
#  SIMPLE IN-MEMORY RATE LIMITER
# ──────────────────────────────────────────────
_rate_store: dict = {}   # {key: [timestamps]}

def rate_limit(max_calls: int, window_secs: int):
    """Decorator: allow max_calls per window_secs per IP."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            ip  = request.remote_addr or "unknown"
            key = f"{f.__name__}:{ip}"
            now = time.time()
            hits = [t for t in _rate_store.get(key, []) if now - t < window_secs]
            if len(hits) >= max_calls:
                return jsonify({"error": "Too many requests. Please slow down."}), 429
            hits.append(now)
            _rate_store[key] = hits
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ──────────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────────
def is_valid_email(email: str) -> bool:
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email))

def sanitize(text: str, max_len: int = 500) -> str:
    """Strip leading/trailing whitespace and cap length."""
    return str(text).strip()[:max_len]

def xp_for_level(n: int) -> int:
    """XP required to REACH level n. Matches frontend exactly."""
    if n <= 1: return 0
    return math.floor(50 * (n - 1) ** 1.6)

def calculate_level(xp: int) -> int:
    """Derive level from total XP — must match xp_for_level above."""
    lvl = 1
    while xp_for_level(lvl + 1) <= xp:
        lvl += 1
    return lvl

def today_str() -> str:
    return date.today().isoformat()

def now_str() -> str:
    return datetime.now().isoformat(timespec='seconds')

# ──────────────────────────────────────────────
#  XP + ACHIEVEMENTS
# ──────────────────────────────────────────────
_ACHIEVEMENT_THRESHOLDS = {
    "xp":           [(100,   "FIRST_100_XP"),   (500,  "XP_500"),
                     (1000,  "XP_MASTER"),       (5000, "XP_LEGEND"),
                     (10000, "XP_GOD")],
    "focus_count":  [(1,    "FIRST_SESSION"),   (5,    "FOCUS_5"),
                     (20,   "FOCUS_20"),         (50,   "FOCUS_50"),
                     (100,  "FOCUS_LEGEND")],
    "tasks_completed": [(1,  "FIRST_TASK"),      (10,   "TASKS_10"),
                        (50, "TASKS_50"),         (100,  "TASKS_100")],
    "streak":       [(3,    "STREAK_3"),         (7,    "STREAK_WEEK"),
                     (14,   "STREAK_2WEEKS"),    (30,   "STREAK_MONTH")],
}

# Human-readable achievement names
ACHIEVEMENT_LABELS = {
    "FIRST_100_XP":    "🌱 First 100 XP",
    "XP_500":          "⚡ 500 XP Milestone",
    "XP_MASTER":       "🔥 XP Master (1000)",
    "XP_LEGEND":       "💎 XP Legend (5000)",
    "XP_GOD":          "👑 XP God (10000)",
    "FIRST_SESSION":   "⏱️ First Focus Session",
    "FOCUS_5":         "🎯 5 Focus Sessions",
    "FOCUS_20":        "🚀 20 Focus Sessions",
    "FOCUS_50":        "💪 50 Focus Sessions",
    "FOCUS_LEGEND":    "🏆 100 Focus Sessions",
    "FIRST_TASK":      "✅ First Task Done",
    "TASKS_10":        "📋 10 Tasks Completed",
    "TASKS_50":        "🌟 50 Tasks Completed",
    "TASKS_100":       "🎖️ 100 Tasks Completed",
    "STREAK_3":        "📅 3-Day Streak",
    "STREAK_WEEK":     "🗓️ Week Warrior",
    "STREAK_2WEEKS":   "💫 2-Week Streak",
    "STREAK_MONTH":    "👑 Monthly Legend",
}

def _check_achievements(conn, user_id: int, stats: sqlite3.Row):
    existing = {r["achievement_name"] for r in
                conn.execute("SELECT achievement_name FROM achievements WHERE user_id = ?",
                             (user_id,)).fetchall()}
    for field, thresholds in _ACHIEVEMENT_THRESHOLDS.items():
        val = stats[field] if field in stats.keys() else 0
        for threshold, name in thresholds:
            if val >= threshold and name not in existing:
                conn.execute(
                    "INSERT INTO achievements (user_id, achievement_name) VALUES (?,?)",
                    (user_id, name))

def add_xp(user_id: int, base_xp: int) -> int:
    """Add XP, recalculate level, check achievements. Returns levels gained."""
    with get_db() as conn:
        stats = conn.execute(
            "SELECT xp, level, focus_count, tasks_completed, streak "
            "FROM user_stats WHERE user_id = ?", (user_id,)).fetchone()
        if not stats:
            return 0
        new_xp    = stats["xp"] + base_xp
        new_level = calculate_level(new_xp)
        conn.execute(
            "UPDATE user_stats SET xp = ?, level = ? WHERE user_id = ?",
            (new_xp, new_level, user_id))
        if new_level > stats["level"]:
            conn.execute(
                "INSERT INTO achievements (user_id, achievement_name) VALUES (?,?)",
                (user_id, f"LEVEL_{new_level}"))
        # Re-fetch updated stats for achievement checks
        updated = conn.execute(
            "SELECT xp, level, focus_count, tasks_completed, streak "
            "FROM user_stats WHERE user_id = ?", (user_id,)).fetchone()
        _check_achievements(conn, user_id, updated)
        conn.commit()
        return new_level - stats["level"]

def _update_daily_activity(conn, user_id: int, minutes: int = 0, session_done: bool = False):
    today = today_str()
    conn.execute('''
        INSERT INTO daily_activity (user_id, act_date, minutes, sessions)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, act_date) DO UPDATE SET
            minutes  = minutes  + excluded.minutes,
            sessions = sessions + excluded.sessions
    ''', (user_id, today, minutes, 1 if session_done else 0))

def _update_streak(conn, user_id: int):
    today = date.today()
    stats = conn.execute(
        "SELECT last_active, streak FROM user_stats WHERE user_id = ?",
        (user_id,)).fetchone()
    if not stats:
        return
    try:
        last = date.fromisoformat(stats["last_active"])
    except Exception:
        last = today
    if last == today - timedelta(days=1):
        new_streak = stats["streak"] + 1
    elif last < today - timedelta(days=1):
        new_streak = 1
    else:
        new_streak = stats["streak"]
    conn.execute(
        "UPDATE user_stats SET streak = ?, last_active = ? WHERE user_id = ?",
        (new_streak, today, user_id))

# ──────────────────────────────────────────────
#  LOGIN REQUIRED
# ──────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated

# ──────────────────────────────────────────────
#  ERROR HANDLERS
# ──────────────────────────────────────────────
@app.errorhandler(404)
def not_found(_):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    return redirect(url_for('index'))

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "detail": str(e)}), 500

@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "Method not allowed"}), 405

# ──────────────────────────────────────────────
#  AUTH ROUTES
# ──────────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['POST'])
@rate_limit(max_calls=10, window_secs=60)
def register():
    name     = sanitize(request.form.get('username', ''), 50)
    email    = sanitize(request.form.get('email', ''), 254).lower()
    password = request.form.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'All fields are required.'}), 400
    if len(name) < 3:
        return jsonify({'error': 'Username must be at least 3 characters.'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'Invalid email format.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400

    hashed = generate_password_hash(password)
    try:
        with get_db() as conn:
            cur = conn.execute(
                'INSERT INTO users (name, email, password) VALUES (?,?,?)',
                (name, email, hashed))
            uid = cur.lastrowid
            conn.execute('INSERT INTO user_stats (user_id) VALUES (?)', (uid,))
            conn.commit()
        return jsonify({'message': 'Registration successful.'}), 200
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already registered.'}), 409

@app.route('/login', methods=['POST'])
@rate_limit(max_calls=20, window_secs=60)
def login():
    email    = sanitize(request.form.get('email', ''), 254).lower()
    password = request.form.get('password', '')

    with get_db() as conn:
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    session.permanent = True
    session['user_id']   = user['id']
    session['user_name'] = user['name']

    with get_db() as conn:
        _update_streak(conn, user['id'])
        conn.commit()

    return jsonify({'message': 'Login successful', 'redirect': '/dashboard', 'user_id': user['id']}), 200

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
@app.route('/dashboard.html')
@login_required
def dashboard():
    return render_template('dashboard.html', name=session.get('user_name', 'User'))

# ──────────────────────────────────────────────
#  PASSWORD RESET
# ──────────────────────────────────────────────
_reset_tokens: dict = {}   # {token: {user_id, expires}}

@app.route('/forgot-password', methods=['GET'])
def forgot_password_page():
    return render_template('forgot-password.html')

@app.route('/forgot-password', methods=['POST'])
@rate_limit(max_calls=5, window_secs=300)
def forgot_password_action():
    email = sanitize(request.form.get('email', ''), 254).lower()
    with get_db() as conn:
        user = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if not user:
        return jsonify({'success': False, 'message': 'Email not found.'}), 404
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        'user_id': user['id'],
        'expires': datetime.now() + timedelta(hours=1)
    }
    reset_link = url_for('reset_password_page', token=token, _external=True)
    print(f"[SKR] Password reset → {reset_link}")
    return jsonify({'success': True, 'reset_link': reset_link})

@app.route('/reset-password/<token>', methods=['GET'])
def reset_password_page(token):
    return render_template('reset-password.html', token=token)

@app.route('/reset-password/<token>', methods=['POST'])
@rate_limit(max_calls=5, window_secs=60)
def reset_password_action(token):
    data = _reset_tokens.get(token)
    if not data or data['expires'] < datetime.now():
        return jsonify({'error': 'Invalid or expired token.'}), 400
    pw = request.form.get('password', '').strip()
    if len(pw) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400
    with get_db() as conn:
        conn.execute('UPDATE users SET password = ? WHERE id = ?',
                     (generate_password_hash(pw), data['user_id']))
        conn.commit()
    del _reset_tokens[token]
    return jsonify({'message': 'Password reset successful.'})

# ──────────────────────────────────────────────
#  API: USER STATS
# ──────────────────────────────────────────────
@app.route('/api/user/stats', methods=['GET'])
@login_required
def api_user_stats():
    uid = session['user_id']
    with get_db() as conn:
        stats = conn.execute('''
            SELECT xp, level, streak, total_minutes, daily_goal,
                   focus_count, tasks_completed, last_active
            FROM user_stats WHERE user_id = ?
        ''', (uid,)).fetchone()
        if not stats:
            return jsonify({'error': 'Stats not found'}), 404

        achievements = conn.execute('''
            SELECT achievement_name, achieved_at
            FROM achievements WHERE user_id = ?
            ORDER BY achieved_at DESC LIMIT 10
        ''', (uid,)).fetchall()

        fc_count = conn.execute(
            'SELECT COUNT(*) as c FROM flashcards WHERE user_id = ?', (uid,)).fetchone()['c']

        task_count = conn.execute(
            'SELECT COUNT(*) as c FROM tasks WHERE user_id = ?', (uid,)).fetchone()['c']

        # Weekly activity (last 7 days) for chart
        weekly = conn.execute('''
            SELECT act_date, minutes, sessions
            FROM daily_activity
            WHERE user_id = ? AND act_date >= date('now', '-6 days')
            ORDER BY act_date
        ''', (uid,)).fetchall()

    # Build 7-slot weekly arrays aligned to Mon–Sun
    week_minutes  = []
    week_sessions = []
    weekly_map    = {r['act_date']: r for r in weekly}
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        row = weekly_map.get(d)
        week_minutes.append(row['minutes']  if row else 0)
        week_sessions.append(row['sessions'] if row else 0)

    current_level = stats['level']
    return jsonify({
        'xp':              stats['xp'],
        'xp_for_level':    xp_for_level(current_level),
        'xp_for_next':     xp_for_level(current_level + 1),
        'level':           stats['level'],
        'streak':          stats['streak'],
        'total_minutes':   stats['total_minutes'],
        'goal':            stats['daily_goal'],
        'focus_count':     stats['focus_count'],
        'tasks_completed': stats['tasks_completed'],
        'flashcard_count': fc_count,
        'total_tasks':     task_count,
        'last_active':     stats['last_active'],
        'weekly_activity': week_minutes,
        'weekly_sessions': week_sessions,
        'achievements':    [
            {**dict(a),
             'display_name': ACHIEVEMENT_LABELS.get(a['achievement_name'],
                             a['achievement_name'].replace('_',' ').title())}
            for a in achievements
        ],
    })

@app.route('/api/update_stats', methods=['POST'])
@login_required
def api_update_stats():
    uid    = session['user_id']
    data   = request.get_json(silent=True) or {}
    action = data.get('action')
    value  = int(data.get('value', 0))

    with get_db() as conn:
        if action == 'xp_time':
            level_up = add_xp(uid, value * 5)
            conn.execute(
                'UPDATE user_stats SET total_minutes = total_minutes + ? WHERE user_id = ?',
                (value, uid))
            _update_daily_activity(conn, uid, minutes=value)

        elif action == 'focus_complete':
            level_up = add_xp(uid, 30)
            conn.execute(
                'UPDATE user_stats SET focus_count = focus_count + 1 WHERE user_id = ?',
                (uid,))
            _update_daily_activity(conn, uid, session_done=True)

        elif action == 'task_complete':
            level_up = add_xp(uid, 5)
            conn.execute(
                'UPDATE user_stats SET tasks_completed = tasks_completed + 1 WHERE user_id = ?',
                (uid,))

        elif action == 'set_goal':
            if not (1 <= value <= 1440):
                return jsonify({'error': 'Goal must be between 1 and 1440 minutes'}), 400
            conn.execute(
                'UPDATE user_stats SET daily_goal = ? WHERE user_id = ?',
                (value, uid))
            conn.commit()
            return jsonify({'success': True})

        elif action == 'reset_focus':
            conn.execute(
                'UPDATE user_stats SET focus_count = 0 WHERE user_id = ?', (uid,))
            conn.commit()
            return jsonify({'success': True})

        else:
            return jsonify({'error': f'Unknown action: {action}'}), 400

        conn.commit()

    return jsonify({'success': True, 'level_up': level_up})

# ──────────────────────────────────────────────
#  API: TASKS
# ──────────────────────────────────────────────
TASK_FIELDS = ['title', 'description', 'subject', 'tag', 'date',
               'due_date', 'priority', 'estimated_mins', 'notes']
VALID_PRIORITIES = {'Low', 'Medium', 'High'}

@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    uid      = session['user_id']
    status   = request.args.get('status')    # 'active' | 'completed'
    priority = request.args.get('priority')  # 'Low' | 'Medium' | 'High'
    sort     = request.args.get('sort', 'date')  # 'date' | 'priority' | 'created'

    order_map = {
        'date':     'COALESCE(NULLIF(due_date,""), date) ASC, created_at DESC',
        'priority': "CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END",
        'created':  'created_at DESC',
    }
    order = order_map.get(sort, order_map['date'])

    where, params = ['user_id = ?'], [uid]
    if status == 'active':
        where.append('completed = 0')
    elif status == 'completed':
        where.append('completed = 1')
    if priority in VALID_PRIORITIES:
        where.append('priority = ?')
        params.append(priority)

    sql = f"SELECT * FROM tasks WHERE {' AND '.join(where)} ORDER BY {order}"
    with get_db() as conn:
        tasks = conn.execute(sql, params).fetchall()
    return jsonify([dict(t) for t in tasks])

@app.route('/api/tasks', methods=['POST'])
@login_required
def create_task():
    uid  = session['user_id']
    data = request.get_json(silent=True) or {}

    title = sanitize(data.get('title', ''), 200)
    if not title:
        return jsonify({'error': 'Title is required.'}), 400

    priority = data.get('priority', 'Medium')
    if priority not in VALID_PRIORITIES:
        priority = 'Medium'

    with get_db() as conn:
        cur = conn.execute('''
            INSERT INTO tasks
                (user_id, title, description, subject, tag, date,
                 due_date, priority, estimated_mins, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ''', (
            uid,
            title,
            sanitize(data.get('description', ''), 1000),
            sanitize(data.get('subject', ''), 100),
            sanitize(data.get('tag', ''), 50),
            sanitize(data.get('date', ''), 10),
            sanitize(data.get('due_date', ''), 10),
            priority,
            int(data.get('estimated_mins', 0)),
            sanitize(data.get('notes', ''), 500),
        ))
        conn.commit()
    return jsonify({'id': cur.lastrowid, 'message': 'Task created'}), 201

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
@login_required
def get_task(task_id):
    uid = session['user_id']
    with get_db() as conn:
        task = conn.execute(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, uid)).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(dict(task))

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    uid  = session['user_id']
    data = request.get_json(silent=True) or {}

    with get_db() as conn:
        task = conn.execute(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, uid)).fetchone()
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        updates, params = [], []

        # Completion toggle
        if 'completed' in data:
            completed = bool(data['completed'])
            updates.append('completed = ?')
            params.append(1 if completed else 0)
            if completed:
                updates.append('completed_at = ?')
                params.append(now_str())
                if not task['completed']:          # only first time
                    add_xp(uid, 5)
                    conn.execute(
                        'UPDATE user_stats SET tasks_completed = tasks_completed + 1 WHERE user_id = ?',
                        (uid,))
            else:
                updates.append('completed_at = ?')
                params.append(None)

        # Editable fields
        for field in TASK_FIELDS:
            if field in data:
                updates.append(f'{field} = ?')
                if field == 'estimated_mins':
                    params.append(int(data[field]))
                elif field == 'priority':
                    params.append(data[field] if data[field] in VALID_PRIORITIES else 'Medium')
                else:
                    params.append(sanitize(str(data[field]),
                                           1000 if field in ('description','notes') else 200))

        if not updates:
            return jsonify({'error': 'No fields to update'}), 400

        params.append(task_id)
        conn.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    return jsonify({'message': 'Task updated'})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    uid = session['user_id']
    with get_db() as conn:
        result = conn.execute(
            'DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, uid))
        conn.commit()
    if result.rowcount == 0:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify({'message': 'Task deleted'})

@app.route('/api/tasks/bulk', methods=['POST'])
@login_required
def bulk_create_tasks():
    """Import multiple tasks at once from self-learning page."""
    uid   = session['user_id']
    items = request.get_json(silent=True)
    if not isinstance(items, list):
        return jsonify({'error': 'Expected a list of tasks'}), 400

    created = 0
    with get_db() as conn:
        for item in items[:50]:   # cap at 50
            title = sanitize(str(item.get('title', '')), 200)
            if not title:
                continue
            conn.execute('''
                INSERT INTO tasks (user_id, title, subject, tag, priority)
                VALUES (?,?,?,?,?)
            ''', (uid, title,
                  sanitize(str(item.get('subject','')), 100),
                  sanitize(str(item.get('tag','')), 50),
                  item.get('priority','Low') if item.get('priority') in VALID_PRIORITIES else 'Low'))
            created += 1
        conn.commit()
    return jsonify({'message': f'{created} tasks imported', 'count': created}), 201

# ──────────────────────────────────────────────
#  API: FLASHCARDS
# ──────────────────────────────────────────────
@app.route('/api/flashcards', methods=['GET'])
@login_required
def get_flashcards():
    uid = session['user_id']
    with get_db() as conn:
        cards = conn.execute(
            'SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at',
            (uid,)).fetchall()
    return jsonify([dict(c) for c in cards])

@app.route('/api/flashcards', methods=['POST'])
@login_required
def create_flashcard():
    uid  = session['user_id']
    data = request.get_json(silent=True) or {}

    # Support single or bulk import
    if isinstance(data, list):
        cards_data = data
    elif 'cards' in data:
        cards_data = data['cards']
    else:
        cards_data = [data]

    created = 0
    with get_db() as conn:
        for item in cards_data[:200]:
            front = sanitize(str(item.get('front', '')), 500)
            back  = sanitize(str(item.get('back',  '')), 500)
            if not front or not back:
                continue
            conn.execute(
                'INSERT INTO flashcards (user_id, front, back) VALUES (?,?,?)',
                (uid, front, back))
            created += 1
        conn.commit()

    if created == 0:
        return jsonify({'error': 'No valid flashcards provided'}), 400
    return jsonify({'message': f'{created} flashcard(s) created', 'count': created}), 201

@app.route('/api/flashcards/<int:card_id>', methods=['DELETE'])
@login_required
def delete_flashcard(card_id):
    uid = session['user_id']
    with get_db() as conn:
        conn.execute('DELETE FROM flashcards WHERE id = ? AND user_id = ?', (card_id, uid))
        conn.commit()
    return jsonify({'message': 'Flashcard deleted'})

@app.route('/api/flashcards/clear', methods=['DELETE'])
@login_required
def clear_flashcards():
    uid = session['user_id']
    with get_db() as conn:
        count = conn.execute(
            'SELECT COUNT(*) as c FROM flashcards WHERE user_id = ?', (uid,)).fetchone()['c']
        conn.execute('DELETE FROM flashcards WHERE user_id = ?', (uid,))
        conn.commit()
    return jsonify({'message': f'{count} flashcards deleted', 'count': count})

# ──────────────────────────────────────────────
#  API: ACTIVITY (for heatmap)
# ──────────────────────────────────────────────
@app.route('/api/activity', methods=['GET'])
@login_required
def get_activity():
    uid  = session['user_id']
    days = min(int(request.args.get('days', 91)), 365)
    with get_db() as conn:
        rows = conn.execute('''
            SELECT act_date, minutes, sessions
            FROM daily_activity
            WHERE user_id = ? AND act_date >= date('now', ? || ' days')
            ORDER BY act_date
        ''', (uid, f'-{days}')).fetchall()
    return jsonify([dict(r) for r in rows])

# ──────────────────────────────────────────────
#  PAGE ROUTES
# ──────────────────────────────────────────────
@app.route('/self-learning')
@login_required
def self_learning():
    return render_template('self-learning.html')

@app.route('/flashcard')
@login_required
def flashcard():
    return render_template('flashcard.html')

@app.route('/stats')
@login_required
def stats():
    return render_template('stats.html')

# ──────────────────────────────────────────────
#  RUN
# ──────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)