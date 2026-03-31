import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('jeak.db');
const JWT_SECRET = process.env.JWT_SECRET || 'jeak-secret-key-12345';

// --- Database Initialization ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    tier INTEGER DEFAULT 2, -- 0: Super, 1: Tier 1, 2: Tier 2
    invite_quota INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    PRIMARY KEY(follower_id, following_id),
    FOREIGN KEY(follower_id) REFERENCES users(id),
    FOREIGN KEY(following_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    tweet_id INTEGER NOT NULL,
    PRIMARY KEY(user_id, tweet_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(tweet_id) REFERENCES tweets(id)
  );

  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    creator_id INTEGER NOT NULL,
    used_by_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id),
    FOREIGN KEY(used_by_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    target_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(actor_id) REFERENCES users(id)
  );
`);

// Migration: Add parent_id and retweet_id to tweets if missing
try {
  db.exec("ALTER TABLE tweets ADD COLUMN parent_id INTEGER REFERENCES tweets(id)");
} catch (e) {}
try {
  db.exec("ALTER TABLE tweets ADD COLUMN retweet_id INTEGER REFERENCES tweets(id)");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN avatar_small TEXT DEFAULT ''");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS tweet_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweet_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    FOREIGN KEY(tweet_id) REFERENCES tweets(id)
  );
`);

// Seed Superuser
const seedSuperuser = () => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('seenpeh');
  if (!user) {
    const hashedPassword = bcrypt.hashSync('19712Almas', 10);
    db.prepare('INSERT INTO users (username, password, tier, invite_quota) VALUES (?, ?, ?, ?)')
      .run('seenpeh', hashedPassword, 0, -1);
    console.log('Superuser seeded.');
  }
};
seedSuperuser();

// --- Middleware ---
const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  // --- Auth Routes ---
  app.post('/api/auth/register', (req, res) => {
    const { username, password, inviteCode } = req.body;
    if (!username || !password || !inviteCode) return res.status(400).json({ error: 'Missing fields' });

    // Check invite code
    const invite = db.prepare('SELECT * FROM invites WHERE code = ? AND used_by_id IS NULL').get(inviteCode);
    
    // Superuser can use a special logic or we just assume they generate codes.
    // But the prompt says "Sign-up is strictly locked behind an invite code."
    // So even the first user needs a code? No, the superuser is seeded.
    // Everyone else needs a code.
    
    if (!invite) return res.status(400).json({ error: 'Invalid or used invite code' });

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const isVIP = inviteCode.startsWith('VIP-');
      const tier = isVIP ? 1 : 2;
      const quota = isVIP ? 3 : 0;

      const result = db.prepare('INSERT INTO users (username, password, tier, invite_quota) VALUES (?, ?, ?, ?)')
        .run(username, hashedPassword, tier, quota);
      
      db.prepare('UPDATE invites SET used_by_id = ? WHERE code = ?').run(result.lastInsertRowid, inviteCode);

      // Notify superusers of new user
      const superusers = db.prepare('SELECT id FROM users WHERE tier = 0').all();
      for (const superuser of superusers as any[]) {
        db.prepare('INSERT INTO notifications (user_id, actor_id, type, target_id) VALUES (?, ?, ?, ?)')
          .run(superuser.id, result.lastInsertRowid, 'new_user', result.lastInsertRowid);
      }

      const token = jwt.sign({ id: result.lastInsertRowid, username, tier }, JWT_SECRET);
      res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ message: 'Registered successfully', user: { id: result.lastInsertRowid, username, tier } });
    } catch (e) {
      res.status(400).json({ error: 'Username taken' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, tier: user.tier }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ message: 'Logged in', user: { id: user.id, username: user.username, tier: user.tier } });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ message: 'Logged out' });
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const user = db.prepare('SELECT id, username, bio, avatar, avatar_small, tier, invite_quota FROM users WHERE id = ?').get(req.user.id);
    res.json(user || null);
  });

  // --- Profile Routes ---
  app.post('/api/settings/profile', authenticateToken, (req: any, res) => {
    const { bio, avatar, avatar_small } = req.body;
    db.prepare('UPDATE users SET bio = ?, avatar = ?, avatar_small = ? WHERE id = ?')
      .run(bio || '', avatar || '', avatar_small || '', req.user.id);
    res.json({ message: 'Profile updated' });
  });

  // --- Tweet Routes ---
  app.post('/api/tweets', authenticateToken, (req: any, res) => {
    const { content, parent_id, retweet_id, images } = req.body;
    if (!content && !retweet_id && (!images || images.length === 0)) return res.status(400).json({ error: 'Content, retweet or images required' });
    
    const result = db.prepare('INSERT INTO tweets (user_id, content, parent_id, retweet_id) VALUES (?, ?, ?, ?)').run(req.user.id, content || null, parent_id || null, retweet_id || null);
    const tweetId = result.lastInsertRowid;

    if (images && Array.isArray(images)) {
      const insertImage = db.prepare('INSERT INTO tweet_images (tweet_id, image_url) VALUES (?, ?)');
      for (const img of images.slice(0, 4)) {
        insertImage.run(tweetId, img);
      }
    }
    
    if (parent_id) {
      const parentTweet: any = db.prepare('SELECT user_id FROM tweets WHERE id = ?').get(parent_id);
      if (parentTweet && parentTweet.user_id !== req.user.id) {
        db.prepare('INSERT INTO notifications (user_id, actor_id, type, target_id) VALUES (?, ?, ?, ?)')
          .run(parentTweet.user_id, req.user.id, 'reply', tweetId);
      }
    }

    res.json({ id: tweetId, content, user_id: req.user.id });
  });

  app.delete('/api/tweets/:id', authenticateToken, (req: any, res) => {
    const tweet: any = db.prepare('SELECT user_id FROM tweets WHERE id = ?').get(req.params.id);
    if (!tweet) return res.status(404).json({ error: 'Tweet not found' });
    if (tweet.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    db.prepare('DELETE FROM likes WHERE tweet_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tweet_images WHERE tweet_id = ?').run(req.params.id);
    db.prepare("DELETE FROM notifications WHERE target_id = ? AND type IN ('like', 'reply')").run(req.params.id);
    db.prepare('DELETE FROM tweets WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
    
    res.json({ message: 'Deleted' });
  });

  app.post('/api/tweets/:id/retweet', authenticateToken, (req: any, res) => {
    const tweetId = req.params.id;
    // Check if already retweeted
    const existing = db.prepare('SELECT id FROM tweets WHERE user_id = ? AND retweet_id = ?').get(req.user.id, tweetId) as any;
    if (existing) {
      db.prepare('DELETE FROM tweets WHERE id = ?').run(existing.id);
      return res.json({ message: 'Retweet removed' });
    }
    const result = db.prepare('INSERT INTO tweets (user_id, retweet_id) VALUES (?, ?)').run(req.user.id, tweetId);
    res.json({ id: result.lastInsertRowid, message: 'Retweeted' });
  });

  const enrichTweets = (tweets: any[]) => {
    return tweets.map(t => {
      const targetId = t.retweet_id || t.id;
      const images = db.prepare('SELECT image_url FROM tweet_images WHERE tweet_id = ?').all(targetId);
      return { ...t, images: images.map((img: any) => img.image_url) };
    });
  };

  app.get('/api/tweets/following', authenticateToken, (req: any, res) => {
    const tweets = db.prepare(`
      SELECT t.*, u.username, u.avatar, u.avatar_small, u.tier,
      rt.content as original_content, ru.username as original_username, ru.avatar as original_avatar, ru.avatar_small as original_avatar_small, rt.created_at as original_created_at,
      (SELECT COUNT(*) FROM likes WHERE tweet_id = t.id OR tweet_id = t.retweet_id) as likes_count,
      (SELECT 1 FROM likes WHERE (tweet_id = t.id OR tweet_id = t.retweet_id) AND user_id = ?) as is_liked,
      (SELECT COUNT(*) FROM tweets WHERE retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id)) as retweets_count,
      (SELECT 1 FROM tweets WHERE user_id = ? AND (retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id))) as is_retweeted,
      (SELECT COUNT(*) FROM tweets WHERE parent_id = t.id) as replies_count
      FROM tweets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN tweets rt ON t.retweet_id = rt.id
      LEFT JOIN users ru ON rt.user_id = ru.id
      WHERE (t.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR t.user_id = ?)
      AND t.parent_id IS NULL
      ORDER BY t.created_at DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id);
    res.json(enrichTweets(tweets));
  });

  app.get('/api/tweets/explore', authenticateToken, (req: any, res) => {
    const tweets = db.prepare(`
      SELECT DISTINCT t.*, u.username, u.avatar, u.avatar_small, u.tier,
      rt.content as original_content, ru.username as original_username, ru.avatar as original_avatar, ru.avatar_small as original_avatar_small, rt.created_at as original_created_at,
      (SELECT COUNT(*) FROM likes WHERE tweet_id = t.id OR tweet_id = t.retweet_id) as likes_count,
      (SELECT 1 FROM likes WHERE (tweet_id = t.id OR tweet_id = t.retweet_id) AND user_id = ?) as is_liked,
      (SELECT COUNT(*) FROM tweets WHERE retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id)) as retweets_count,
      (SELECT 1 FROM tweets WHERE user_id = ? AND (retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id))) as is_retweeted,
      (SELECT COUNT(*) FROM tweets WHERE parent_id = t.id) as replies_count
      FROM tweets t
      JOIN users u ON t.user_id = u.id
      JOIN likes l ON (t.id = l.tweet_id OR t.retweet_id = l.tweet_id)
      LEFT JOIN tweets rt ON t.retweet_id = rt.id
      LEFT JOIN users ru ON rt.user_id = ru.id
      WHERE l.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      AND t.user_id != ?
      AND t.parent_id IS NULL
      ORDER BY t.created_at DESC
      LIMIT 50
    `).all(req.user.id, req.user.id, req.user.id, req.user.id);
    res.json(enrichTweets(tweets));
  });

  app.get('/api/tweets/user/:username', authenticateToken, (req: any, res) => {
    const tweets = db.prepare(`
      SELECT t.*, u.username, u.avatar, u.avatar_small, u.tier,
      rt.content as original_content, ru.username as original_username, ru.avatar as original_avatar, ru.avatar_small as original_avatar_small, rt.created_at as original_created_at,
      (SELECT COUNT(*) FROM likes WHERE tweet_id = t.id OR tweet_id = t.retweet_id) as likes_count,
      (SELECT 1 FROM likes WHERE (tweet_id = t.id OR tweet_id = t.retweet_id) AND user_id = ?) as is_liked,
      (SELECT COUNT(*) FROM tweets WHERE retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id)) as retweets_count,
      (SELECT 1 FROM tweets WHERE user_id = ? AND (retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id))) as is_retweeted,
      (SELECT COUNT(*) FROM tweets WHERE parent_id = t.id) as replies_count
      FROM tweets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN tweets rt ON t.retweet_id = rt.id
      LEFT JOIN users ru ON rt.user_id = ru.id
      WHERE u.username = ?
      AND t.parent_id IS NULL
      ORDER BY t.created_at DESC
    `).all(req.user.id, req.user.id, req.params.username);
    res.json(enrichTweets(tweets));
  });

  app.post('/api/tweets/:id/like', authenticateToken, (req: any, res) => {
    try {
      db.prepare('INSERT INTO likes (user_id, tweet_id) VALUES (?, ?)').run(req.user.id, req.params.id);
      
      const tweet: any = db.prepare('SELECT user_id FROM tweets WHERE id = ?').get(req.params.id);
      if (tweet && tweet.user_id !== req.user.id) {
        db.prepare('INSERT INTO notifications (user_id, actor_id, type, target_id) VALUES (?, ?, ?, ?)')
          .run(tweet.user_id, req.user.id, 'like', req.params.id);
      }

      res.json({ message: 'Liked' });
    } catch (e) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND tweet_id = ?').run(req.user.id, req.params.id);
      res.json({ message: 'Unliked' });
    }
  });

  app.get('/api/tweets/:id', authenticateToken, (req: any, res) => {
    const tweetId = req.params.id;
    const tweet: any = db.prepare(`
      SELECT t.*, u.username, u.avatar, u.avatar_small, u.tier,
      rt.content as original_content, ru.username as original_username, ru.avatar as original_avatar, ru.avatar_small as original_avatar_small, rt.created_at as original_created_at,
      (SELECT COUNT(*) FROM likes WHERE tweet_id = t.id OR tweet_id = t.retweet_id) as likes_count,
      (SELECT 1 FROM likes WHERE (tweet_id = t.id OR tweet_id = t.retweet_id) AND user_id = ?) as is_liked,
      (SELECT COUNT(*) FROM tweets WHERE retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id)) as retweets_count,
      (SELECT 1 FROM tweets WHERE user_id = ? AND (retweet_id = t.id OR (t.retweet_id IS NOT NULL AND retweet_id = t.retweet_id))) as is_retweeted,
      (SELECT COUNT(*) FROM tweets WHERE parent_id = t.id) as replies_count
      FROM tweets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN tweets rt ON t.retweet_id = rt.id
      LEFT JOIN users ru ON rt.user_id = ru.id
      WHERE t.id = ?
    `).get(req.user.id, req.user.id, tweetId);

    if (!tweet) return res.status(404).json({ error: 'Tweet not found' });

    const enrichedTweet = enrichTweets([tweet])[0];

    let parent = null;
    if (tweet.parent_id) {
      parent = db.prepare(`
        SELECT t.*, u.username, u.avatar, u.avatar_small, u.tier,
        (SELECT COUNT(*) FROM likes WHERE tweet_id = t.id) as likes_count,
        (SELECT 1 FROM likes WHERE tweet_id = t.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM tweets WHERE retweet_id = t.id) as retweets_count,
        (SELECT 1 FROM tweets WHERE user_id = ? AND retweet_id = t.id) as is_retweeted,
        (SELECT COUNT(*) FROM tweets WHERE parent_id = t.id) as replies_count
        FROM tweets t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = ?
      `).get(req.user.id, req.user.id, tweet.parent_id);
      if (parent) parent = enrichTweets([parent])[0];
    }

    const replies = db.prepare(`
      SELECT t.*, u.username, u.avatar, u.avatar_small, u.tier,
      (SELECT COUNT(*) FROM likes WHERE tweet_id = t.id) as likes_count,
      (SELECT 1 FROM likes WHERE tweet_id = t.id AND user_id = ?) as is_liked,
      (SELECT COUNT(*) FROM tweets WHERE retweet_id = t.id) as retweets_count,
      (SELECT 1 FROM tweets WHERE user_id = ? AND retweet_id = t.id) as is_retweeted,
      (SELECT COUNT(*) FROM tweets WHERE parent_id = t.id) as replies_count
      FROM tweets t
      JOIN users u ON t.user_id = u.id
      WHERE t.parent_id = ?
      ORDER BY t.created_at ASC
    `).all(req.user.id, req.user.id, tweetId);

    res.json({ tweet: enrichedTweet, replies: enrichTweets(replies), parent });
  });

  // --- User Routes ---
  app.get('/api/users/search', authenticateToken, (req, res) => {
    const q = req.query.q || '';
    const users = db.prepare('SELECT id, username, bio, avatar FROM users WHERE username LIKE ? LIMIT 20').all(`%${q}%`);
    const tweets = db.prepare(`
      SELECT t.*, u.username, u.avatar 
      FROM tweets t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.content LIKE ? 
      ORDER BY t.created_at DESC 
      LIMIT 20
    `).all(`%${q}%`);
    res.json({ users, tweets });
  });

  app.get('/api/users/:username', authenticateToken, (req: any, res) => {
    const user: any = db.prepare(`
      SELECT id, username, bio, avatar, avatar_small, tier,
      (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) as following_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = users.id) as followers_count,
      (SELECT COUNT(*) FROM tweets WHERE user_id = users.id) as tweets_count,
      (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = users.id) as is_following
      FROM users WHERE username = ?
    `).get(req.user.id, req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user || null);
  });

  app.post('/api/users/:id/follow', authenticateToken, (req: any, res) => {
    if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot follow yourself' });
    try {
      db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, req.params.id);
      
      const followsBack = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.params.id, req.user.id);
      const type = followsBack ? 'follow_back' : 'follow';

      db.prepare('INSERT INTO notifications (user_id, actor_id, type, target_id) VALUES (?, ?, ?, ?)')
        .run(req.params.id, req.user.id, type, req.user.id);

      res.json({ message: 'Followed' });
    } catch (e) {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, req.params.id);
      res.json({ message: 'Unfollowed' });
    }
  });

  app.get('/api/users/:username/followers', authenticateToken, (req, res) => {
    const user: any = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const followers = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.bio, u.tier
      FROM users u
      JOIN follows f ON u.id = f.follower_id
      WHERE f.following_id = ?
    `).all(user.id);
    res.json(followers);
  });

  app.get('/api/users/:username/following', authenticateToken, (req, res) => {
    const user: any = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const following = db.prepare(`
      SELECT u.id, u.username, u.avatar, u.bio, u.tier
      FROM users u
      JOIN follows f ON u.id = f.following_id
      WHERE f.follower_id = ?
    `).all(user.id);
    res.json(following);
  });

  // --- Invite Routes ---
  app.post('/api/invites/generate', authenticateToken, (req: any, res) => {
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (user.tier === 2) return res.status(403).json({ error: 'Tier 2 users cannot generate codes' });
    if (user.tier === 1 && user.invite_quota <= 0) return res.status(403).json({ error: 'Invite quota exceeded' });

    const prefix = user.tier === 0 ? 'VIP-' : 'STD-';
    const code = prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    db.prepare('INSERT INTO invites (code, creator_id) VALUES (?, ?)').run(code, req.user.id);
    if (user.tier === 1) {
      db.prepare('UPDATE users SET invite_quota = invite_quota - 1 WHERE id = ?').run(req.user.id);
    }

    res.json({ code });
  });

  app.get('/api/invites', authenticateToken, (req: any, res) => {
    const invites = db.prepare('SELECT * FROM invites WHERE creator_id = ?').all(req.user.id);
    res.json(invites);
  });

  // --- Settings ---
  app.post('/api/settings/bio', authenticateToken, (req: any, res) => {
    const { bio } = req.body;
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.user.id);
    res.json({ message: 'Bio updated' });
  });

  app.post('/api/settings/password', authenticateToken, (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    
    const user: any = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
    res.json({ message: 'Password updated' });
  });

  app.get('/api/notifications', authenticateToken, (req: any, res) => {
    const notifications = db.prepare(`
      SELECT n.*, u.username as actor_username, u.avatar as actor_avatar, t.content as tweet_content
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      LEFT JOIN tweets t ON n.target_id = t.id AND n.type IN ('like', 'reply')
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(req.user.id);
    res.json(notifications);
  });

  app.post('/api/notifications/read', authenticateToken, (req: any, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Marked as read' });
  });

  app.get('/api/notifications/unread-count', authenticateToken, (req: any, res) => {
    const count: any = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
    res.json({ count: count.count });
  });

  // --- Vite / Static ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
