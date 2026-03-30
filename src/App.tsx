import { useState, useEffect } from 'react';
import { 
  Home, 
  Compass, 
  Search, 
  User, 
  Plus, 
  LogOut, 
  Settings as SettingsIcon,
  Heart,
  MessageCircle,
  Repeat,
  Share,
  ArrowLeft,
  X,
  Bell,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ThemeProvider, useTheme } from './ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Tweet {
  id: number;
  user_id: number;
  username: string;
  avatar: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_liked?: boolean;
  retweets_count: number;
  is_retweeted?: boolean;
  replies_count: number;
  retweet_id?: number;
  original_content?: string;
  original_username?: string;
  original_avatar?: string;
  original_created_at?: string;
}

interface UserProfile {
  id: number;
  username: string;
  bio: string;
  avatar: string;
  tier: number;
  following_count: number;
  followers_count: number;
  tweets_count: number;
  is_following?: boolean;
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants = {
    primary: 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90',
    secondary: 'bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5',
    ghost: 'hover:bg-black/5 dark:hover:bg-white/5',
  };
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50',
        variants[variant as keyof typeof variants],
        className
      )} 
      {...props} 
    />
  );
};

const Input = ({ className, ...props }: any) => (
  <input 
    className={cn(
      'w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border-none focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all',
      className
    )} 
    {...props} 
  />
);

interface TweetCardProps {
  key?: any;
  tweet: Tweet & { tier?: number };
  onLike: (id: number) => void | Promise<void>;
  onRetweet: (id: number) => void | Promise<void>;
  onReply: (tweet: Tweet) => void;
  onNavigate?: (username: string) => void;
  onViewTweet?: (id: number) => void;
  onDelete?: (id: number) => void;
  currentUserId?: number;
}

const TweetCard = ({ tweet, onLike, onRetweet, onReply, onNavigate, onViewTweet, onDelete, currentUserId }: TweetCardProps) => {
  const isRetweet = !!tweet.retweet_id;
  const displayContent = isRetweet ? tweet.original_content : tweet.content;
  const displayUsername = isRetweet ? tweet.original_username : tweet.username;
  const displayAvatar = isRetweet ? tweet.original_avatar : tweet.avatar;
  const displayCreatedAt = isRetweet ? tweet.original_created_at : tweet.created_at;
  const displayTier = isRetweet ? 1 : tweet.tier; // Only show blue tick for original author if they are superuser

  return (
    <div 
      onClick={() => onViewTweet?.(tweet.retweet_id || tweet.id)}
      className="p-4 border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
    >
      {isRetweet && (
        <div className="flex items-center gap-2 text-xs text-black/40 dark:text-white/40 mb-2 ml-10">
          <Repeat size={12} />
          <span className="font-bold">{tweet.username} retweeted</span>
        </div>
      )}
      <div className="flex gap-3">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.(displayUsername || '');
          }}
          className="w-10 h-10 rounded-full bg-black/10 dark:bg-white/10 flex-shrink-0 overflow-hidden active:scale-90 transition-transform"
        >
          {displayAvatar && <img src={displayAvatar} alt={displayUsername} className="w-full h-full object-cover" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 min-w-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.(displayUsername || '');
                }}
                className="font-bold truncate hover:underline"
              >
                {displayUsername}
              </button>
              {displayTier === 0 && <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" />}
              <span className="text-xs text-black/40 dark:text-white/40 truncate">
                {new Date(displayCreatedAt || '').toLocaleDateString()}
              </span>
            </div>
            {currentUserId === tweet.user_id && !isRetweet && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(tweet.id);
                }}
                className="p-1.5 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors text-black/20 dark:text-white/20"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <p className="text-[15px] leading-relaxed mb-3 whitespace-pre-wrap">{displayContent}</p>
          <div className="flex justify-between max-w-xs text-black/40 dark:text-white/40">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onReply(tweet);
              }}
              className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
            >
              <MessageCircle size={18} />
              <span className="text-xs">{tweet.replies_count}</span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRetweet(tweet.retweet_id || tweet.id);
              }}
              className={cn("flex items-center gap-1.5 hover:text-green-500 transition-colors", tweet.is_retweeted && "text-green-500")}
            >
              <Repeat size={18} />
              <span className="text-xs">{tweet.retweets_count}</span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onLike(tweet.retweet_id || tweet.id);
              }}
              className={cn("flex items-center gap-1.5 hover:text-red-500 transition-colors", tweet.is_liked && "text-red-500")}
            >
              <Heart size={18} fill={tweet.is_liked ? "currentColor" : "none"} />
              <span className="text-xs">{tweet.likes_count}</span>
            </button>
            <button 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors"
            >
              <Share size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'following' | 'explore' | 'notifications' | 'search' | 'profile' | 'settings' | 'tweet-detail' | 'follower-list' | 'following-list'>('following');
  const [previousView, setPreviousView] = useState<'following' | 'explore' | 'notifications' | 'search' | 'profile' | 'settings' | 'follower-list' | 'following-list'>('following');
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [selectedTweetId, setSelectedTweetId] = useState<number | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Tweet | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const fetchUnread = async () => {
    const res = await fetch('/api/notifications/unread-count');
    if (res.ok) {
      const data = await res.json();
      setUnreadCount(data.count);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setUser(data);
        setLoading(false);
        if (data) fetchUnread();
      });
  }, []);

  useEffect(() => {
    if (user) {
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const navigateToProfile = (username: string) => {
    setPreviousView(view as any);
    setTargetUsername(username);
    setView('profile');
  };

  const navigateToTweet = (id: number) => {
    setPreviousView(view as any);
    setSelectedTweetId(id);
    setView('tweet-detail');
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest">Jeak...</div>;

  if (!user) {
    return <AuthPage mode={authMode} setMode={setAuthMode} onAuth={setUser} />;
  }

  const handleNav = (v: any) => {
    if (v === 'profile') setTargetUsername(user.username);
    if (v === 'notifications') setUnreadCount(0);
    setView(v);
  };

  const handleDeleteTweet = async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/tweets/${confirmDelete}`, { method: 'DELETE' });
    if (res.ok) {
      setConfirmDelete(null);
      triggerRefresh();
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
        <div className="max-w-2xl mx-auto pb-20 md:pb-0 md:pl-64">
          {/* Sidebar (Desktop) */}
          <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r border-black/5 dark:border-white/5 flex-col p-6 gap-2">
            <div className="text-2xl font-black mb-8 px-4">JEAK</div>
            <NavItems active={view} setView={handleNav} unreadCount={unreadCount} />
            <div className="mt-auto">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-black/60 dark:text-white/60"
              >
                <LogOut size={20} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </nav>

          {/* Main Content */}
          <main className="min-h-screen">
            <AnimatePresence mode="wait">
              <motion.div
                key={view + (targetUsername || '') + (selectedTweetId || '') + refreshKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {view === 'following' && <FeedView type="following" onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} />}
                {view === 'explore' && <FeedView type="explore" onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} />}
                {view === 'notifications' && <NotificationsView onNavigate={navigateToProfile} onViewTweet={navigateToTweet} refreshKey={refreshKey} />}
                {view === 'search' && <SearchView onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} />}
                {view === 'profile' && <ProfileView username={targetUsername || user.username} isOwn={!targetUsername || targetUsername === user.username} setView={setView} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} onDelete={setConfirmDelete} currentUserId={user.id} refreshKey={refreshKey} />}
                {view === 'settings' && <SettingsView user={user} setView={setView} onUpdateUser={setUser} />}
                {view === 'tweet-detail' && <TweetDetailView tweetId={selectedTweetId!} onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} onBack={() => setView(previousView)} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} />}
                {view === 'follower-list' && <UserListView username={targetUsername!} type="followers" onNavigate={navigateToProfile} onBack={() => setView('profile')} />}
                {view === 'following-list' && <UserListView username={targetUsername!} type="following" onNavigate={navigateToProfile} onBack={() => setView('profile')} />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Bottom Nav (Mobile) */}
          <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-black/5 dark:border-white/5 flex justify-around p-4 z-40">
            <NavItems active={view} setView={handleNav} mobile unreadCount={unreadCount} />
          </nav>

          {/* Floating Action Button */}
          <button 
            onClick={() => {
              setReplyTo(null);
              setIsComposeOpen(true);
            }}
            className="fixed bottom-24 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-50"
          >
            <Plus size={24} />
          </button>

          {/* Compose Modal */}
          <AnimatePresence>
            {isComposeOpen && (
              <ComposeModal 
                onClose={() => { setIsComposeOpen(false); setReplyTo(null); }} 
                replyTo={replyTo} 
                onTweeted={triggerRefresh}
              />
            )}
          </AnimatePresence>

          {/* Confirm Delete Modal */}
          <AnimatePresence>
            {confirmDelete && (
              <ConfirmModal 
                title="Delete Post?"
                message="This can't be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results."
                onConfirm={handleDeleteTweet}
                onCancel={() => setConfirmDelete(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </ThemeProvider>
  );
}

// --- Sub-Views ---

function NavItems({ active, setView, mobile, unreadCount }: any) {
  const items = [
    { id: 'following', icon: Home, label: 'Feed' },
    { id: 'explore', icon: Compass, label: 'Explore' },
    { id: 'notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setView(item.id)}
          className={cn(
            "flex items-center gap-4 p-4 rounded-2xl transition-all relative",
            active === item.id 
              ? "bg-black/5 dark:bg-white/5 text-black dark:text-white" 
              : "text-black/40 dark:text-white/40 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
            mobile && "flex-col gap-1 p-2 flex-1"
          )}
        >
          <div className="relative">
            <item.icon size={24} strokeWidth={active === item.id ? 2.5 : 2} />
            {item.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-black">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </div>
          {!mobile && <span className="font-bold text-lg">{item.label}</span>}
        </button>
      ))}
    </>
  );
}

function FeedView({ type, onNavigate, onReply, onViewTweet, currentUserId, onDelete, refreshKey }: { type: 'following' | 'explore', onNavigate: (username: string) => void, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, currentUserId?: number, onDelete?: (id: number) => void, refreshKey?: number }) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTweets = async () => {
    const res = await fetch(`/api/tweets/${type}`);
    const data = await res.json();
    setTweets(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTweets();
  }, [type, refreshKey]);

  const handleLike = async (id: number) => {
    await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    setTweets(prev => prev.map(t => {
      const targetId = t.retweet_id || t.id;
      if (targetId === id) {
        return { 
          ...t, 
          is_liked: !t.is_liked, 
          likes_count: t.is_liked ? t.likes_count - 1 : t.likes_count + 1 
        };
      }
      return t;
    }));
  };

  const handleRetweet = async (id: number) => {
    await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    setTweets(prev => prev.map(t => {
      const targetId = t.retweet_id || t.id;
      if (targetId === id) {
        return { 
          ...t, 
          is_retweeted: !t.is_retweeted, 
          retweets_count: t.is_retweeted ? t.retweets_count - 1 : t.retweets_count + 1 
        };
      }
      return t;
    }));
  };

  return (
    <div className="divide-y divide-black/5 dark:border-white/5">
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5">
        <h1 className="text-xl font-black capitalize">{type}</h1>
      </header>
      {loading ? (
        <div className="p-8 text-center text-black/40 dark:text-white/40">Loading...</div>
      ) : tweets.length === 0 ? (
        <div className="p-12 text-center text-black/40 dark:text-white/40">
          <p className="text-lg font-medium mb-2">Nothing here yet</p>
          <p className="text-sm">Start following people to see their posts</p>
        </div>
      ) : (
        tweets.map(tweet => <TweetCard key={tweet.id} tweet={tweet} onLike={handleLike} onRetweet={handleRetweet} onReply={onReply} onNavigate={onNavigate} onViewTweet={onViewTweet} currentUserId={currentUserId} onDelete={onDelete} />)
      )}
    </div>
  );
}

function NotificationsView({ onNavigate, onViewTweet, refreshKey }: { onNavigate: (username: string) => void, onViewTweet: (id: number) => void, refreshKey?: number }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data);
        setLoading(false);
        fetch('/api/notifications/read', { method: 'POST' });
      });
  }, [refreshKey]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} className="text-red-500 fill-red-500" />;
      case 'reply': return <MessageCircle size={16} className="text-blue-500" />;
      case 'follow': return <User size={16} className="text-green-500" />;
      case 'new_user': return <Plus size={16} className="text-purple-500" />;
      default: return null;
    }
  };

  const getMessage = (n: any) => {
    switch (n.type) {
      case 'like': return 'liked your post';
      case 'reply': return 'replied to your post';
      case 'follow': return 'followed you';
      case 'new_user': return 'just joined Jeak';
      default: return '';
    }
  };

  return (
    <div className="divide-y divide-black/5 dark:border-white/5">
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5">
        <h1 className="text-xl font-black">Notifications</h1>
      </header>
      {loading ? (
        <div className="p-8 text-center text-black/40 dark:text-white/40">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center text-black/40 dark:text-white/40">
          <p className="text-lg font-medium mb-2">No notifications yet</p>
          <p className="text-sm">When people interact with you, you'll see it here</p>
        </div>
      ) : (
        notifications.map(n => (
          <div 
            key={n.id} 
            className={cn("p-4 flex gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer", !n.is_read && "bg-black/[0.01] dark:bg-white/[0.01]")}
            onClick={() => {
              if (n.type === 'like' || n.type === 'reply') onViewTweet(n.target_id);
              else onNavigate(n.actor_username);
            }}
          >
            <div className="pt-1">{getIcon(n.type)}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  {n.actor_avatar && <img src={n.actor_avatar} className="w-full h-full object-cover" />}
                </div>
                <span className="text-sm">
                  <span className="font-bold">{n.actor_username}</span> {getMessage(n)}
                </span>
              </div>
              {n.tweet_content && (
                <p className="text-sm text-black/40 dark:text-white/40 line-clamp-2">{n.tweet_content}</p>
              )}
              <span className="text-[10px] text-black/20 dark:text-white/20">
                {new Date(n.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SearchView({ onNavigate, onReply, onViewTweet, currentUserId, onDelete, refreshKey }: { onNavigate: (username: string) => void, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, currentUserId?: number, onDelete?: (id: number) => void, refreshKey?: number }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ users: any[], tweets: Tweet[] }>({ users: [], tweets: [] });

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 2) return;
    const res = await fetch(`/api/users/search?q=${val}`);
    const data = await res.json();
    setResults(data);
  };

  useEffect(() => {
    if (query.length >= 2) handleSearch(query);
  }, [refreshKey]);

  const handleLike = async (id: number) => {
    await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    setResults(prev => ({
      ...prev,
      tweets: prev.tweets.map(t => {
        const targetId = t.retweet_id || t.id;
        if (targetId === id) {
          return { 
            ...t, 
            is_liked: !t.is_liked, 
            likes_count: t.is_liked ? t.likes_count - 1 : t.likes_count + 1 
          };
        }
        return t;
      })
    }));
  };

  const handleRetweet = async (id: number) => {
    await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    setResults(prev => ({
      ...prev,
      tweets: prev.tweets.map(t => {
        const targetId = t.retweet_id || t.id;
        if (targetId === id) {
          return { 
            ...t, 
            is_retweeted: !t.is_retweeted, 
            retweets_count: t.is_retweeted ? t.retweets_count - 1 : t.retweets_count + 1 
          };
        }
        return t;
      })
    }));
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <Input 
          placeholder="Search Jeak..." 
          value={query} 
          onChange={(e: any) => handleSearch(e.target.value)}
        />
      </div>
      
      {query.length >= 2 && (
        <div className="space-y-8">
          {results.users.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-4">Users</h2>
              <div className="space-y-4">
                {results.users.map(u => (
                  <button 
                    key={u.id} 
                    onClick={() => onNavigate(u.username)}
                    className="flex items-center gap-3 w-full text-left hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-2xl transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                      {u.avatar && <img src={u.avatar} className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <div className="font-bold">{u.username}</div>
                      <div className="text-sm text-black/40 dark:text-white/40">{u.bio}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.tweets.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-4">Tweets</h2>
              <div className="divide-y divide-black/5 dark:border-white/5 -mx-4">
                {results.tweets.map(t => <TweetCard key={t.id} tweet={t} onLike={handleLike} onRetweet={handleRetweet} onReply={onReply} onNavigate={onNavigate} onViewTweet={onViewTweet} currentUserId={currentUserId} onDelete={onDelete} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileView({ username, isOwn, setView, onReply, onViewTweet, onDelete, currentUserId, refreshKey }: { username: string, isOwn?: boolean, setView?: any, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, onDelete?: (id: number) => void, currentUserId?: number, refreshKey?: number }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);

  useEffect(() => {
    fetch(`/api/users/${username}`).then(res => res.json()).then(setProfile);
    fetch(`/api/tweets/user/${username}`).then(res => res.json()).then(setTweets);
  }, [username, refreshKey]);

  const handleFollow = async () => {
    if (!profile) return;
    const res = await fetch(`/api/users/${profile.id}/follow`, { method: 'POST' });
    if (res.ok) {
      setProfile(prev => prev ? {
        ...prev,
        is_following: !prev.is_following,
        followers_count: prev.is_following ? prev.followers_count - 1 : prev.followers_count + 1
      } : null);
    }
  };

  const handleLike = async (id: number) => {
    await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    setTweets(prev => prev.map(t => {
      const targetId = t.retweet_id || t.id;
      if (targetId === id) {
        return { 
          ...t, 
          is_liked: !t.is_liked, 
          likes_count: t.is_liked ? t.likes_count - 1 : t.likes_count + 1 
        };
      }
      return t;
    }));
  };

  const handleRetweet = async (id: number) => {
    await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    setTweets(prev => prev.map(t => {
      const targetId = t.retweet_id || t.id;
      if (targetId === id) {
        return { 
          ...t, 
          is_retweeted: !t.is_retweeted, 
          retweets_count: t.is_retweeted ? t.retweets_count - 1 : t.retweets_count + 1 
        };
      }
      return t;
    }));
  };

  if (!profile) return null;

  return (
    <div>
      <div className="h-32 bg-black/5 dark:bg-white/5" />
      <div className="px-4 -mt-12 mb-6">
        <div className="flex justify-between items-end mb-4">
          <div className="w-24 h-24 rounded-full border-4 border-white dark:border-black bg-black/10 dark:bg-white/10 overflow-hidden">
            {profile.avatar && <img src={profile.avatar} className="w-full h-full object-cover" />}
          </div>
          {isOwn ? (
            <Button variant="secondary" onClick={() => setView('settings')}>
              <SettingsIcon size={20} />
            </Button>
          ) : (
            <Button 
              variant={profile.is_following ? 'secondary' : 'primary'}
              onClick={handleFollow}
            >
              {profile.is_following ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black">{profile.username}</h1>
          {profile.tier === 0 && <CheckCircle2 size={20} className="text-blue-500" />}
        </div>
        <p className="text-black/60 dark:text-white/60 mb-4">{profile.bio || "No bio yet."}</p>
        <div className="flex gap-4 text-sm">
          <button onClick={() => setView('following-list')} className="hover:underline">
            <strong className="font-bold">{profile.following_count}</strong> <span className="text-black/40 dark:text-white/40">Following</span>
          </button>
          <button onClick={() => setView('follower-list')} className="hover:underline">
            <strong className="font-bold">{profile.followers_count}</strong> <span className="text-black/40 dark:text-white/40">Followers</span>
          </button>
          <span><strong className="font-bold">{profile.tweets_count}</strong> <span className="text-black/40 dark:text-white/40">Tweets</span></span>
        </div>
      </div>
      <div className="border-t border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5">
        {tweets.map(t => <TweetCard key={t.id} tweet={t} onLike={handleLike} onRetweet={handleRetweet} onReply={onReply} onViewTweet={onViewTweet} onDelete={onDelete} currentUserId={currentUserId} />)}
      </div>
    </div>
  );
}

function UserListView({ username, type, onNavigate, onBack }: { username: string, type: 'followers' | 'following', onNavigate: (username: string) => void, onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${username}/${type}`)
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, [username, type]);

  return (
    <div>
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black capitalize">{type}</h1>
      </header>
      {loading ? (
        <div className="p-8 text-center text-black/40 dark:text-white/40">Loading...</div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center text-black/40 dark:text-white/40">
          <p className="text-lg font-medium mb-2">No {type} yet</p>
        </div>
      ) : (
        <div className="divide-y divide-black/5 dark:border-white/5">
          {users.map(u => (
            <button 
              key={u.id} 
              onClick={() => onNavigate(u.username)}
              className="flex items-center gap-3 w-full text-left hover:bg-black/5 dark:hover:bg-white/5 p-4 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex-shrink-0">
                {u.avatar && <img src={u.avatar} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <div className="font-bold truncate">{u.username}</div>
                  {u.tier === 0 && <CheckCircle2 size={14} className="text-blue-500" />}
                </div>
                <div className="text-sm text-black/40 dark:text-white/40 truncate">{u.bio}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TweetDetailView({ tweetId, onNavigate, onReply, onViewTweet, onBack, currentUserId, onDelete, refreshKey }: { tweetId: number, onNavigate: (username: string) => void, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, onBack: () => void, currentUserId?: number, onDelete?: (id: number) => void, refreshKey?: number }) {
  const [data, setData] = useState<{ tweet: Tweet, replies: Tweet[], parent?: Tweet } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tweets/${tweetId}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, [tweetId, refreshKey]);

  const handleLike = async (id: number) => {
    await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    setData(prev => {
      if (!prev) return null;
      const updateTweet = (t: Tweet) => {
        const targetId = t.retweet_id || t.id;
        if (targetId === id) {
          return { ...t, is_liked: !t.is_liked, likes_count: t.is_liked ? t.likes_count - 1 : t.likes_count + 1 };
        }
        return t;
      };
      return {
        tweet: updateTweet(prev.tweet),
        replies: prev.replies.map(updateTweet)
      };
    });
  };

  const handleRetweet = async (id: number) => {
    await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    setData(prev => {
      if (!prev) return null;
      const updateTweet = (t: Tweet) => {
        const targetId = t.retweet_id || t.id;
        if (targetId === id) {
          return { ...t, is_retweeted: !t.is_retweeted, retweets_count: t.is_retweeted ? t.retweets_count - 1 : t.retweets_count + 1 };
        }
        return t;
      };
      return {
        tweet: updateTweet(prev.tweet),
        replies: prev.replies.map(updateTweet)
      };
    });
  };

  if (loading) return <div className="p-8 text-center text-black/40 dark:text-white/40">Loading thread...</div>;
  if (!data) return <div className="p-8 text-center text-black/40 dark:text-white/40">Post not found</div>;

  return (
    <div>
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-black">Thread</h1>
      </header>

      {data.parent && (
        <div className="relative">
          <div className="absolute left-9 top-14 bottom-0 w-0.5 bg-black/5 dark:bg-white/5" />
          <TweetCard 
            tweet={data.parent} 
            onLike={handleLike} 
            onRetweet={handleRetweet} 
            onReply={onReply} 
            onNavigate={onNavigate} 
            onViewTweet={onViewTweet}
            onDelete={onDelete}
            currentUserId={currentUserId}
          />
        </div>
      )}

      <div className="p-4 border-b border-black/5 dark:border-white/5">
        <div className="flex gap-3 mb-4">
          <button 
            onClick={() => onNavigate(data.tweet.username)}
            className="w-12 h-12 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"
          >
            {data.tweet.avatar && <img src={data.tweet.avatar} className="w-full h-full object-cover" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onNavigate(data.tweet.username)} className="font-bold block hover:underline">{data.tweet.username}</button>
                  {(data.tweet as any).tier === 0 && <CheckCircle2 size={16} className="text-blue-500" />}
                </div>
                <div className="text-sm text-black/40 dark:text-white/40">@{data.tweet.username}</div>
              </div>
              {currentUserId === data.tweet.user_id && (
                <button 
                  onClick={() => onDelete?.(data.tweet.id)}
                  className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors text-black/20 dark:text-white/20"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-xl leading-relaxed mb-4 whitespace-pre-wrap">{data.tweet.content}</p>
        <div className="text-sm text-black/40 dark:text-white/40 mb-4 pb-4 border-b border-black/5 dark:border-white/5">
          {new Date(data.tweet.created_at).toLocaleTimeString()} · {new Date(data.tweet.created_at).toLocaleDateString()}
        </div>
        <div className="flex gap-6 text-sm mb-4 pb-4 border-b border-black/5 dark:border-white/5">
          <span><strong className="font-bold">{data.tweet.retweets_count}</strong> <span className="text-black/40 dark:text-white/40">Retweets</span></span>
          <span><strong className="font-bold">{data.tweet.likes_count}</strong> <span className="text-black/40 dark:text-white/40">Likes</span></span>
        </div>
        <div className="flex justify-around text-black/40 dark:text-white/40">
          <button onClick={() => onReply(data.tweet)} className="hover:text-blue-500 transition-colors"><MessageCircle size={22} /></button>
          <button onClick={() => handleRetweet(data.tweet.id)} className={cn("hover:text-green-500 transition-colors", data.tweet.is_retweeted && "text-green-500")}><Repeat size={22} /></button>
          <button onClick={() => handleLike(data.tweet.id)} className={cn("hover:text-red-500 transition-colors", data.tweet.is_liked && "text-red-500")}><Heart size={22} fill={data.tweet.is_liked ? "currentColor" : "none"} /></button>
          <button className="hover:text-black dark:hover:text-white transition-colors"><Share size={22} /></button>
        </div>
      </div>

      <div className="divide-y divide-black/5 dark:border-white/5">
        {data.replies.map(reply => (
          <TweetCard 
            key={reply.id} 
            tweet={reply} 
            onLike={handleLike} 
            onRetweet={handleRetweet} 
            onReply={onReply} 
            onNavigate={onNavigate} 
            onViewTweet={onViewTweet}
            onDelete={onDelete}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

function SettingsView({ user, setView, onUpdateUser }: any) {
  const { toggleTheme } = useTheme();
  const [newPass, setNewPass] = useState('');
  const [bio, setBio] = useState(user.bio || '');
  const [invites, setInvites] = useState<any[]>([]);
  const [quota, setQuota] = useState(user.invite_quota);

  useEffect(() => {
    fetch('/api/invites').then(res => res.json()).then(setInvites);
    fetch('/api/auth/me').then(res => res.json()).then(d => {
      setQuota(d.invite_quota);
      setBio(d.bio || '');
    });
  }, []);

  const generateInvite = async () => {
    const res = await fetch('/api/invites/generate', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setInvites(prev => [...prev, { code: data.code, used_by_id: null }]);
      if (user.tier === 1) setQuota(prev => prev - 1);
    }
  };

  const updatePassword = async () => {
    await fetch('/api/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPass })
    });
    setNewPass('');
    alert('Password updated');
  };

  const updateBio = async () => {
    const res = await fetch('/api/settings/bio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio })
    });
    if (res.ok) {
      onUpdateUser({ ...user, bio });
      alert('Bio updated');
    }
  };

  return (
    <div className="p-4 space-y-12">
      <header className="flex items-center gap-4">
        <button onClick={() => setView('profile')} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-black">Settings</h1>
      </header>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Profile</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium px-1">Biography</label>
          <textarea 
            className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border-none focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all resize-none h-24"
            placeholder="Tell the world about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <Button onClick={updateBio} className="w-full">Update Bio</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Appearance</h2>
        <Button variant="secondary" className="w-full flex justify-between items-center" onClick={toggleTheme}>
          <span>Toggle Theme</span>
          <Compass size={20} />
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Security</h2>
        <div className="flex gap-2">
          <Input 
            type="password" 
            placeholder="New Password" 
            value={newPass} 
            onChange={(e: any) => setNewPass(e.target.value)} 
          />
          <Button onClick={updatePassword}>Update</Button>
        </div>
      </section>

      {user.tier < 2 && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Invite Codes</h2>
            <span className="text-xs font-mono">{quota === -1 ? 'Unlimited' : `${quota} left`}</span>
          </div>
          <Button 
            className="w-full" 
            onClick={generateInvite} 
            disabled={quota === 0}
          >
            Generate New Code
          </Button>
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.code} className="flex justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-sm">
                <span>{inv.code}</span>
                <span className={inv.used_by_id ? "text-green-500" : "text-black/40 dark:text-white/40"}>
                  {inv.used_by_id ? "Used" : "Available"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = "Delete", isDestructive = true }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, confirmText?: string, isDestructive?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-white/10 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-black w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-black/5 dark:border-white/5"
      >
        <div className="flex items-center gap-3 mb-4 text-red-500">
          <AlertCircle size={24} />
          <h3 className="text-lg font-black">{title}</h3>
        </div>
        <p className="text-black/60 dark:text-white/60 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button 
            className={cn("flex-1", isDestructive ? "bg-red-500 text-white hover:bg-red-600" : "")} 
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ComposeModal({ onClose, replyTo, onTweeted }: { onClose: () => void, replyTo?: Tweet | null, onTweeted: () => void }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          parent_id: replyTo?.id
        })
      });
      if (res.ok) {
        onTweeted();
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-white/10 backdrop-blur-sm z-[60] flex items-start justify-center pt-20 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-black w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-black/5 dark:border-white/5"
      >
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <X size={24} />
          </button>
          <Button onClick={handleSubmit} disabled={!content.trim()}>{replyTo ? 'Reply' : 'Post'}</Button>
        </div>
        
        {replyTo && (
          <div className="mb-4 p-3 rounded-2xl bg-black/5 dark:bg-white/5 text-sm text-black/60 dark:text-white/60">
            Replying to <span className="font-bold">@{replyTo.username}</span>
          </div>
        )}

        <textarea 
          autoFocus
          placeholder={replyTo ? "Post your reply" : "What's happening?"}
          className="w-full h-40 bg-transparent border-none outline-none text-xl resize-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </motion.div>
    </div>
  );
}

function AuthPage({ mode, setMode, onAuth }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, inviteCode })
    });
    const data = await res.json();
    if (res.ok) {
      onAuth(data.user);
    } else {
      setError(data.error);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6 text-black dark:text-white">
      <div className="w-full max-w-sm space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter mb-2">JEAK</h1>
          <p className="text-black/40 dark:text-white/40 uppercase text-xs tracking-widest font-bold">Invite Only Social</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-4 bg-red-500/10 text-red-500 text-sm rounded-2xl text-center font-medium">{error}</div>}
          <Input placeholder="Username" value={username} onChange={(e: any) => setUsername(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} />
          {mode === 'register' && (
            <Input placeholder="Invite Code" value={inviteCode} onChange={(e: any) => setInviteCode(e.target.value)} />
          )}
          <Button className="w-full py-4 text-lg">{mode === 'login' ? 'Login' : 'Join Jeak'}</Button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
          >
            {mode === 'login' ? "Don't have an invite? Join waitlist" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
