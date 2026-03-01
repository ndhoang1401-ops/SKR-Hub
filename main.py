from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
import sqlite3
import os
import re
import math
import secrets
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "skr_hub_ultimate_final_key_2026")
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

DATABASE = "database.db"

# ==================== DATABASE SETUP ====================
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        # Users
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # User stats
        conn.execute('''
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id INTEGER PRIMARY KEY,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                streak INTEGER DEFAULT 0,
                total_minutes INTEGER DEFAULT 0,
                daily_goal INTEGER DEFAULT 30,
                focus_count INTEGER DEFAULT 0,
                tasks_completed INTEGER DEFAULT 0,
                last_active DATE DEFAULT CURRENT_DATE,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        # Achievements
        conn.execute('''
            CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                achievement_name TEXT,
                achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        # Tasks
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                priority TEXT DEFAULT 'Medium',
                completed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        # Flashcards
        conn.execute('''
            CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        conn.commit()

init_db()

# ==================== DECORATORS ====================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

# ==================== VALIDATION & HELPERS ====================
def is_valid_email(email):
    return re.match(r'^[^@]+@[^@]+\.[^@]+$', email) is not None

def calculate_level(xp):
    return math.floor((xp / 100) ** 0.8) + 1

def add_xp(user_id, base_xp, reason=""):
    with get_db() as conn:
        stats = conn.execute("SELECT xp, level FROM user_stats WHERE user_id = ?", (user_id,)).fetchone()
        if not stats:
            return 0
        new_xp = stats["xp"] + base_xp
        new_level = calculate_level(new_xp)
        conn.execute("UPDATE user_stats SET xp = ?, level = ? WHERE user_id = ?", (new_xp, new_level, user_id))
        if new_level > stats["level"]:
            conn.execute("INSERT INTO achievements (user_id, achievement_name) VALUES (?, ?)",
                         (user_id, f"LEVEL_{new_level}"))
        conn.commit()
        return new_level - stats["level"]

# ==================== AUTH ROUTES ====================
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    name = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip().lower()
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
            cur = conn.execute('INSERT INTO users (name, email, password) VALUES (?,?,?)',
                               (name, email, hashed))
            user_id = cur.lastrowid
            conn.execute('INSERT INTO user_stats (user_id) VALUES (?)', (user_id,))
            conn.commit()
        return jsonify({'message': 'Registration successful.'}), 200
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already exists.'}), 409

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')

    with get_db() as conn:
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()

    if user and check_password_hash(user['password'], password):
        session.permanent = True
        session['user_id'] = user['id']
        session['user_name'] = user['name']

        # Update streak
        with get_db() as conn:
            today = datetime.now().date()
            stats = conn.execute("SELECT last_active, streak FROM user_stats WHERE user_id = ?", (user['id'],)).fetchone()
            if stats:
                last = datetime.strptime(stats['last_active'], "%Y-%m-%d").date()
                if last == today - timedelta(days=1):
                    new_streak = stats['streak'] + 1
                elif last < today - timedelta(days=1):
                    new_streak = 1
                else:
                    new_streak = stats['streak']
                conn.execute("UPDATE user_stats SET streak = ?, last_active = ? WHERE user_id = ?",
                             (new_streak, today, user['id']))
            conn.commit()
        return jsonify({'message': 'Login successful'}), 200
    else:
        return jsonify({'error': 'Invalid email or password.'}), 401

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', name=session.get('user_name'))

@app.route('/dashboard.html')
def dashboard_html():
    return redirect(url_for('dashboard'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# ==================== PASSWORD RESET (FIXED & AUTO REDIRECT) ====================
reset_tokens = {}

@app.route('/forgot-password', methods=['GET'])
def forgot_password_page():
    return render_template('forgot-password.html')

@app.route('/forgot-password', methods=['POST'])
def forgot_password_action():
    email = request.form.get('email', '').strip().lower()
    with get_db() as conn:
        user = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if user:
        token = secrets.token_urlsafe(32)
        reset_tokens[token] = {
            'user_id': user['id'],
            'expires': datetime.now() + timedelta(hours=1)
        }
        reset_link = url_for('reset_password_page', token=token, _external=True)
        print(f"🔐 Password reset link for {email}: {reset_link}")
        return jsonify({'success': True, 'reset_link': reset_link, 'message': 'Redirecting to reset page...'})
    else:
        return jsonify({'success': False, 'message': 'Email not found.'}), 404

@app.route('/reset-password/<token>', methods=['GET'])
def reset_password_page(token):
    return render_template('reset-password.html', token=token)

@app.route('/reset-password/<token>', methods=['POST'])
def reset_password_action(token):
    data = reset_tokens.get(token)
    if not data or data['expires'] < datetime.now():
        return jsonify({'error': 'Invalid or expired token.'}), 400
    new_password = request.form.get('password', '').strip()
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400
    hashed = generate_password_hash(new_password)
    with get_db() as conn:
        conn.execute('UPDATE users SET password = ? WHERE id = ?', (hashed, data['user_id']))
        conn.commit()
    del reset_tokens[token]
    return jsonify({'message': 'Password reset successful. You can now login.'})

# ==================== API: USER STATS ====================
@app.route('/api/user/stats', methods=['GET'])
@login_required
def api_user_stats():
    user_id = session['user_id']
    with get_db() as conn:
        stats = conn.execute('''
            SELECT xp, level, streak, total_minutes, daily_goal, focus_count, tasks_completed, last_active
            FROM user_stats WHERE user_id = ?
        ''', (user_id,)).fetchone()
        achievements = conn.execute('''
            SELECT achievement_name, achieved_at FROM achievements WHERE user_id = ?
            ORDER BY achieved_at DESC LIMIT 5
        ''', (user_id,)).fetchall()
        flashcard_count = conn.execute('SELECT COUNT(*) as count FROM flashcards WHERE user_id = ?', (user_id,)).fetchone()['count']
    if not stats:
        return jsonify({'error': 'No stats found'}), 404
    return jsonify({
        'xp': stats['xp'],
        'level': stats['level'],
        'streak': stats['streak'],
        'total_minutes': stats['total_minutes'],
        'goal': stats['daily_goal'],
        'focus_count': stats['focus_count'],
        'tasks_completed': stats['tasks_completed'],
        'flashcard_count': flashcard_count,
        'last_active': stats['last_active'],
        'achievements': [dict(a) for a in achievements]
    })

@app.route('/api/update_stats', methods=['POST'])
@login_required
def api_update_stats():
    user_id = session['user_id']
    data = request.get_json()
    action = data.get('action')
    value = data.get('value', 0)

    if action == 'xp_time':
        level_up = add_xp(user_id, value * 5, 'time')
        with get_db() as conn:
            conn.execute('UPDATE user_stats SET total_minutes = total_minutes + ? WHERE user_id = ?', (value, user_id))
            conn.commit()
    elif action == 'focus_complete':
        level_up = add_xp(user_id, 30, 'focus')
        with get_db() as conn:
            conn.execute('UPDATE user_stats SET focus_count = focus_count + 1 WHERE user_id = ?', (user_id,))
            conn.commit()
    elif action == 'task_complete':
        level_up = add_xp(user_id, 5, 'task')
        with get_db() as conn:
            conn.execute('UPDATE user_stats SET tasks_completed = tasks_completed + 1 WHERE user_id = ?', (user_id,))
            conn.commit()
    elif action == 'set_goal':
        with get_db() as conn:
            conn.execute('UPDATE user_stats SET daily_goal = ? WHERE user_id = ?', (value, user_id))
            conn.commit()
        return jsonify({'success': True})
    elif action == 'reset_focus':
        with get_db() as conn:
            conn.execute('UPDATE user_stats SET focus_count = 0 WHERE user_id = ?', (user_id,))
            conn.commit()
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Invalid action'}), 400

    return jsonify({'success': True, 'level_up': level_up})

# ==================== API: TASKS ====================
@app.route('/api/tasks', methods=['GET'])
@login_required
def get_tasks():
    user_id = session['user_id']
    with get_db() as conn:
        tasks = conn.execute('SELECT * FROM tasks WHERE user_id = ? ORDER BY date', (user_id,)).fetchall()
    return jsonify([dict(t) for t in tasks])

@app.route('/api/tasks', methods=['POST'])
@login_required
def create_task():
    user_id = session['user_id']
    data = request.get_json()
    title = data.get('title', '').strip()
    date = data.get('date')
    priority = data.get('priority', 'Medium')
    if not title or not date:
        return jsonify({'error': 'Title and date are required.'}), 400
    with get_db() as conn:
        cur = conn.execute('''
            INSERT INTO tasks (user_id, title, date, priority)
            VALUES (?, ?, ?, ?)
        ''', (user_id, title, date, priority))
        conn.commit()
        task_id = cur.lastrowid
    return jsonify({'id': task_id, 'message': 'Task created'}), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@login_required
def update_task(task_id):
    user_id = session['user_id']
    data = request.get_json()
    completed = data.get('completed')
    title = data.get('title')
    with get_db() as conn:
        task = conn.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id)).fetchone()
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        if completed is not None:
            old_completed = task['completed']
            conn.execute('UPDATE tasks SET completed = ? WHERE id = ?', (completed, task_id))
            if completed and not old_completed:
                add_xp(user_id, 5, 'task')
                conn.execute('UPDATE user_stats SET tasks_completed = tasks_completed + 1 WHERE user_id = ?', (user_id,))
        if title:
            conn.execute('UPDATE tasks SET title = ? WHERE id = ?', (title, task_id))
        conn.commit()
    return jsonify({'message': 'Task updated'})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(task_id):
    user_id = session['user_id']
    with get_db() as conn:
        conn.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', (task_id, user_id))
        conn.commit()
    return jsonify({'message': 'Task deleted'})

# ==================== API: FLASHCARDS ====================
@app.route('/api/flashcards', methods=['GET'])
@login_required
def get_flashcards():
    user_id = session['user_id']
    with get_db() as conn:
        cards = conn.execute('SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at', (user_id,)).fetchall()
    return jsonify([dict(c) for c in cards])

@app.route('/api/flashcards', methods=['POST'])
@login_required
def create_flashcard():
    user_id = session['user_id']
    data = request.get_json()
    front = data.get('front', '').strip()
    back = data.get('back', '').strip()
    if not front or not back:
        return jsonify({'error': 'Front and back are required.'}), 400
    with get_db() as conn:
        cur = conn.execute('''
            INSERT INTO flashcards (user_id, front, back)
            VALUES (?, ?, ?)
        ''', (user_id, front, back))
        conn.commit()
        card_id = cur.lastrowid
    return jsonify({'id': card_id, 'message': 'Flashcard created'}), 201

@app.route('/api/flashcards/<int:card_id>', methods=['DELETE'])
@login_required
def delete_flashcard(card_id):
    user_id = session['user_id']
    with get_db() as conn:
        conn.execute('DELETE FROM flashcards WHERE id = ? AND user_id = ?', (card_id, user_id))
        conn.commit()
    return jsonify({'message': 'Flashcard deleted'})

@app.route('/api/flashcards/clear', methods=['DELETE'])
@login_required
def clear_flashcards():
    user_id = session['user_id']
    with get_db() as conn:
        conn.execute('DELETE FROM flashcards WHERE user_id = ?', (user_id,))
        conn.commit()
    return jsonify({'message': 'All flashcards deleted'})

# ==================== SUB PAGES ====================
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)