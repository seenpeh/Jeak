import { useState, useEffect, ChangeEvent, FormEvent, useRef, useCallback } from 'react';
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
  AlertCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Camera,
  Eye,
  EyeOff,
  Gift,
  Lock,
  Download,
  MessageSquare,
  Send,
  MoreVertical,
  Shield,
  Ban,
  Check,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { getCroppedImgCanvas, resizeImage, compressImage, fileToBase64 } from './lib/imageUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ThemeProvider, useTheme } from './ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Utils ---
function formatRelativeTime(dateString: string) {
  const now = new Date();
  // Add 3:30 hours offset as requested
  const date = new Date(new Date(dateString).getTime() + (3.5 * 60 * 60 * 1000));
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} days ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} months ago`;
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} years ago`;
}

function formatTehranTime(dateString: string) {
  // Add 3:30 hours offset as requested
  const date = new Date(new Date(dateString).getTime() + (3.5 * 60 * 60 * 1000));
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tehran',
    hour12: false
  }).format(date);
}

// --- Encryption Utils ---
async function deriveKey(userId1: number, userId2: number) {
  const ids = [userId1, userId2].sort((a, b) => a - b);
  const seed = `jeak-secure-chat-${ids[0]}-${ids[1]}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptMessage(text: string, key: CryptoKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptMessage(encryptedBase64: string, key: CryptoKey) {
  try {
    const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    return "[Encrypted Message]";
  }
}

// --- Types ---
interface Tweet {
  id: number;
  user_id: number;
  username: string;
  avatar: string;
  avatar_small?: string;
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
  original_avatar_small?: string;
  original_created_at?: string;
  images?: string[];
}

interface UserProfile {
  id: number;
  username: string;
  bio: string;
  avatar: string;
  avatar_small?: string;
  tier: number;
  following_count: number;
  followers_count: number;
  tweets_count: number;
  is_following?: boolean;
}

const ImageGrid = ({ images, onImageClick }: { images: string[], onImageClick: (index: number) => void }) => {
  if (!images || images.length === 0) return null;

  const gridStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2',
    4: 'grid-cols-2',
  };

  return (
    <div className={cn('grid gap-1 mt-3 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10', gridStyles[images.length as keyof typeof gridStyles])}>
      {images.map((img, i) => (
        <div 
          key={i} 
          className={cn(
            'relative cursor-pointer hover:opacity-90 transition-opacity aspect-video',
            images.length === 3 && i === 0 && 'row-span-2 aspect-auto'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onImageClick(i);
          }}
        >
          <img 
            src={img} 
            alt={`Post image ${i + 1}`} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      ))}
    </div>
  );
};

const Lightbox = ({ images, initialIndex, onClose }: { images: string[], initialIndex: number, onClose: () => void }) => {
  const [index, setIndex] = useState(initialIndex);

  const handlePrev = (e: any) => {
    e.stopPropagation();
    setIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e: any) => {
    e.stopPropagation();
    setIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleSave = async (e: any) => {
    e.stopPropagation();
    try {
      const response = await fetch(images[index]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jeak-image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to save image:', err);
      // Fallback: open in new tab if fetch fails (e.g. CORS)
      window.open(images[index], '_blank');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-6 right-6 flex gap-2 z-[101]">
        <button 
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 px-4"
          onClick={handleSave}
        >
          <Download size={20} />
          <span className="text-sm font-bold">Save</span>
        </button>
        <button 
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          onClick={onClose}
        >
          <X size={24} />
        </button>
      </div>

      {images.length > 1 && (
        <>
          <button 
            className="absolute left-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-[101]"
            onClick={handlePrev}
          >
            <ChevronLeft size={32} />
          </button>
          <button 
            className="absolute right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-[101]"
            onClick={handleNext}
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      <div className="w-full h-full flex items-center justify-center p-4">
        <motion.img 
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          src={images[index]} 
          alt="Full screen"
          className="max-w-full max-h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white text-sm font-medium">
          {index + 1} / {images.length}
        </div>
      )}
    </motion.div>
  );
};

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

const TweetCard = ({ tweet, onLike, onRetweet, onReply, onNavigate, onViewTweet, onDelete, currentUserId, onImageClick }: TweetCardProps & { onImageClick?: (images: string[], index: number) => void }) => {
  const [showExactDate, setShowExactDate] = useState(false);
  const isRetweet = !!tweet.retweet_id;
  const displayContent = isRetweet ? tweet.original_content : tweet.content;
  const displayUsername = isRetweet ? tweet.original_username : tweet.username;
  const displayAvatar = isRetweet ? (tweet.original_avatar_small || tweet.original_avatar) : (tweet.avatar_small || tweet.avatar);
  const displayCreatedAt = isRetweet ? tweet.original_created_at : tweet.created_at;
  const displayTier = isRetweet ? 1 : tweet.tier; // Only show blue tick for original author if they are superuser
  const images = tweet.images || [];

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
          {displayAvatar && <img src={displayAvatar} alt={displayUsername} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
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
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExactDate(!showExactDate);
                }}
                className="text-xs text-black/40 dark:text-white/40 truncate hover:underline"
              >
                {showExactDate 
                  ? formatTehranTime(displayCreatedAt || '') 
                  : formatRelativeTime(displayCreatedAt || '')}
              </button>
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
          
          <ImageGrid 
            images={images} 
            onImageClick={(index) => onImageClick?.(images, index)} 
          />

          <div className="flex justify-between max-w-xs text-black/40 dark:text-white/40 mt-3">
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
  const [view, setView] = useState<'home' | 'notifications' | 'search' | 'messages' | 'profile' | 'settings' | 'tweet-detail' | 'follower-list' | 'following-list' | 'chat-room'>('home');
  const [previousView, setPreviousView] = useState<'home' | 'notifications' | 'search' | 'messages' | 'profile' | 'settings' | 'follower-list' | 'following-list' | 'chat-room'>('home');
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [selectedTweetId, setSelectedTweetId] = useState<number | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Tweet | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);

  const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch (e) {
      // Only log if we are still logged in and it's not a generic network error
      if (user && !(e instanceof TypeError && e.message === 'Failed to fetch')) {
        console.error('Failed to fetch unread count:', e);
      }
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = res.ok ? await res.json() : null;
        setUser(data);
        if (data) fetchUnread();
      } catch (e) {
        console.error('Auth check failed:', e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed:', e);
    }
    setUser(null);
  };

  const navigateToProfile = (username: string) => {
    setPreviousView(view as any);
    setTargetUsername(username);
    setView('profile');
  };

  const navigateToChat = (userId: number) => {
    setPreviousView(view as any);
    setTargetUserId(userId);
    setView('chat-room');
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
    try {
      const res = await fetch(`/api/tweets/${confirmDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmDelete(null);
        triggerRefresh();
      }
    } catch (e) {
      console.error('Failed to delete tweet:', e);
    }
  };

  return (
    <>
      <AnimatePresence>
        {lightbox && (
          <Lightbox 
            images={lightbox.images} 
            initialIndex={lightbox.index} 
            onClose={() => setLightbox(null)} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {newInviteCode && (
          <InviteCardModal 
            code={newInviteCode} 
            onClose={() => setNewInviteCode(null)} 
          />
        )}
      </AnimatePresence>
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
        <div className={cn("max-w-2xl mx-auto md:pl-64", view !== 'chat-room' && "pb-20 md:pb-0")}>
          {/* Sidebar (Desktop) */}
          <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r border-black/5 dark:border-white/5 flex-col p-6 gap-2">
            <div className="text-2xl font-black mb-8 px-4">JEAK</div>
            <NavItems active={view} setView={handleNav} unreadCount={unreadCount} />
          </nav>

          {/* Main Content */}
          <main className={cn("min-h-screen", view === 'chat-room' && "h-screen flex flex-col overflow-hidden")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={view + (targetUsername || '') + (selectedTweetId || '') + refreshKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(view === 'chat-room' && "h-full flex flex-col")}
              >
                {view === 'home' && <HomeView onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} />}
                {view === 'notifications' && <NotificationsView onNavigate={navigateToProfile} onViewTweet={navigateToTweet} refreshKey={refreshKey} />}
                {view === 'search' && <SearchView onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} />}
                {view === 'messages' && <MessagesView onNavigateChat={navigateToChat} />}
                {view === 'chat-room' && <ChatRoomView otherUserId={targetUserId!} currentUserId={user.id} onBack={() => setView('messages')} onNavigateProfile={navigateToProfile} onImageClick={(images, index) => setLightbox({ images, index })} />}
                {view === 'profile' && <ProfileView username={targetUsername || user.username} isOwn={!targetUsername || targetUsername === user.username} setView={setView} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} onDelete={setConfirmDelete} currentUserId={user.id} refreshKey={refreshKey} onMessage={navigateToChat} />}
                {view === 'settings' && <SettingsView user={user} setView={setView} onUpdateUser={setUser} onNewInvite={setNewInviteCode} onLogout={handleLogout} />}
                {view === 'tweet-detail' && <TweetDetailView tweetId={selectedTweetId!} onNavigate={navigateToProfile} onReply={(t) => { setReplyTo(t); setIsComposeOpen(true); }} onViewTweet={navigateToTweet} onBack={() => setView(previousView)} currentUserId={user.id} onDelete={setConfirmDelete} refreshKey={refreshKey} onImageClick={(images, index) => setLightbox({ images, index })} />}
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
          {!['search', 'chat-room', 'messages'].includes(view) && (
            <button 
              onClick={() => {
                setReplyTo(null);
                setIsComposeOpen(true);
              }}
              className="fixed bottom-24 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-50"
            >
              <Plus size={24} />
            </button>
          )}

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
    </>
  );
}

// --- Sub-Views ---

function NavItems({ active, setView, mobile, unreadCount }: any) {
  const items = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
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

function HomeView({ onNavigate, onReply, onViewTweet, currentUserId, onDelete, refreshKey }: { onNavigate: (username: string) => void, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, currentUserId?: number, onDelete?: (id: number) => void, refreshKey?: number }) {
  const [activeTab, setActiveTab] = useState<'following' | 'explore'>('following');

  return (
    <div>
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 border-b border-black/5 dark:border-white/5">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('following')}
            className={cn(
              "flex-1 py-4 text-sm font-bold transition-colors relative",
              activeTab === 'following' ? "text-black dark:text-white" : "text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            Following
            {activeTab === 'following' && (
              <motion.div layoutId="home-tab" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-black dark:bg-white rounded-full" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('explore')}
            className={cn(
              "flex-1 py-4 text-sm font-bold transition-colors relative",
              activeTab === 'explore' ? "text-black dark:text-white" : "text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            Explore
            {activeTab === 'explore' && (
              <motion.div layoutId="home-tab" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-black dark:bg-white rounded-full" />
            )}
          </button>
        </div>
      </header>
      <FeedView 
        type={activeTab} 
        onNavigate={onNavigate} 
        onReply={onReply} 
        onViewTweet={onViewTweet} 
        currentUserId={currentUserId} 
        onDelete={onDelete} 
        refreshKey={refreshKey} 
        hideHeader
      />
    </div>
  );
}

function FeedView({ type, onNavigate, onReply, onViewTweet, currentUserId, onDelete, refreshKey, hideHeader }: { type: 'following' | 'explore', onNavigate: (username: string) => void, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, currentUserId?: number, onDelete?: (id: number) => void, refreshKey?: number, hideHeader?: boolean }) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchTweets = async (isInitial = false) => {
    if (!isInitial && (loadingMore || !hasMore)) return;
    
    if (isInitial) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offset;
      const res = await fetch(`/api/tweets/${type}?limit=${limit}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        const newTweets = Array.isArray(data) ? data : [];
        if (isInitial) {
          setTweets(newTweets);
        } else {
          setTweets(prev => [...prev, ...newTweets]);
        }
        setHasMore(newTweets.length === limit);
        setOffset(currentOffset + newTweets.length);
      }
    } catch (e) {
      console.error('Failed to fetch tweets:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTweets(true);
  }, [type, refreshKey]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTweetRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchTweets();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, offset]);

  const handleLike = async (id: number) => {
    try {
      await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to like tweet:', e);
    }
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
    try {
      await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to retweet:', e);
    }
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
      {!hideHeader && (
        <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5">
          <h1 className="text-xl font-black capitalize">{type}</h1>
        </header>
      )}
      {loading ? (
        <div className="p-8 text-center text-black/40 dark:text-white/40">Loading...</div>
      ) : tweets.length === 0 ? (
        <div className="p-12 text-center text-black/40 dark:text-white/40">
          <p className="text-lg font-medium mb-2">Nothing here yet</p>
          <p className="text-sm">Start following people to see their posts</p>
        </div>
      ) : (
        tweets.map((tweet, index) => (
          <div key={tweet.id} ref={index === tweets.length - 1 ? lastTweetRef : null}>
            <TweetCard 
              tweet={tweet} 
              onLike={handleLike} 
              onRetweet={handleRetweet} 
              onReply={onReply} 
              onNavigate={onNavigate} 
              onViewTweet={onViewTweet} 
              currentUserId={currentUserId} 
              onDelete={onDelete} 
              onImageClick={() => onViewTweet(tweet.retweet_id || tweet.id)}
            />
          </div>
        ))
      )}
    </div>
  );
}

function NotificationsView({ onNavigate, onViewTweet, refreshKey }: { onNavigate: (username: string) => void, onViewTweet: (id: number) => void, refreshKey?: number }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        const data = res.ok ? await res.json() : [];
        setNotifications(Array.isArray(data) ? data : []);
        
        // Mark as read
        try {
          await fetch('/api/notifications/read', { method: 'POST' });
        } catch (e) {
          console.error('Failed to mark notifications as read:', e);
        }
      } catch (e) {
        console.error('Failed to fetch notifications:', e);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    loadNotifications();
  }, [refreshKey]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} className="text-red-500 fill-red-500" />;
      case 'reply': return <MessageCircle size={16} className="text-blue-500" />;
      case 'follow': 
      case 'follow_back': return <User size={16} className="text-green-500" />;
      case 'new_user': return <Plus size={16} className="text-purple-500" />;
      default: return null;
    }
  };

  const getMessage = (n: any) => {
    switch (n.type) {
      case 'like': return 'liked your post';
      case 'reply': return 'replied to your post';
      case 'follow': return 'followed you';
      case 'follow_back': return 'followed you back';
      case 'new_user': return 'just joined Jeak';
      default: return '';
    }
  };

  const handleFollow = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}/follow`, { method: 'POST' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => {
          if (n.actor_id === id) {
            return { ...n, is_actor_followed: !n.is_actor_followed };
          }
          return n;
        }));
      }
    } catch (e) {
      console.error('Failed to follow user:', e);
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    {n.actor_avatar && <img src={n.actor_avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <span className="text-sm">
                    <span className="font-bold">{n.actor_username}</span> {getMessage(n)}
                  </span>
                </div>
                {(n.type === 'follow' || n.type === 'follow_back') && (
                  <Button 
                    size="sm" 
                    variant={n.is_actor_followed ? 'secondary' : 'primary'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollow(n.actor_id);
                    }}
                  >
                    {n.is_actor_followed ? 'Following' : 'Follow'}
                  </Button>
                )}
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
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<{ users: any[], tweets: Tweet[] }>({ users: [], tweets: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentUsers, setRecentUsers] = useState<any[]>(() => {
    const saved = localStorage.getItem('recentUsers');
    return saved ? JSON.parse(saved) : [];
  });

  const addToHistory = (q: string) => {
    if (!q.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== q);
      const updated = [q, ...filtered].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromHistory = (q: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(item => item !== q);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  };

  const addToUserHistory = (user: any) => {
    setRecentUsers(prev => {
      const filtered = prev.filter(u => u.id !== user.id);
      const updated = [user, ...filtered].slice(0, 10);
      localStorage.setItem('recentUsers', JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromUserHistory = (id: number) => {
    setRecentUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem('recentUsers', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const clearUserHistory = () => {
    setRecentUsers([]);
    localStorage.removeItem('recentUsers');
  };

  const handleSearch = async (val: string, isInitial = true) => {
    if (val.length < 2) return;
    if (!isInitial && (loadingMore || !hasMore)) return;

    if (isInitial) {
      setHasSearched(true);
      setOffset(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offset;
      const res = await fetch(`/api/users/search?q=${val}&limit=${limit}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        if (isInitial) {
          setResults(data);
          if (data.users.length > 0 || data.tweets.length > 0) {
            addToHistory(val);
          }
        } else {
          setResults(prev => ({
            users: [...prev.users, ...data.users],
            tweets: [...prev.tweets, ...data.tweets]
          }));
        }
        setHasMore(data.users.length === limit || data.tweets.length === limit);
        setOffset(currentOffset + Math.max(data.users.length, data.tweets.length));
      }
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (query.length >= 2) handleSearch(query, true);
  }, [refreshKey]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastResultRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        handleSearch(query, false);
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingMore, hasMore, offset, query]);

  const handleLike = async (id: number) => {
    try {
      await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to like tweet:', e);
    }
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
    try {
      await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to retweet:', e);
    }
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
      <div className="mb-6 flex gap-2">
        <Input 
          placeholder="Search Jeak..." 
          value={query} 
          onChange={(e: any) => {
            setQuery(e.target.value);
            setHasSearched(false);
          }}
          onKeyDown={(e: any) => e.key === 'Enter' && handleSearch(query)}
        />
        <button 
          onClick={() => handleSearch(query)}
          className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl active:scale-95 transition-transform"
        >
          <Search size={20} />
        </button>
      </div>
      
      {query.length < 2 && (searchHistory.length > 0 || recentUsers.length > 0) && (
        <div className="space-y-8">
          {searchHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Recent Searches</h2>
                <button 
                  onClick={clearHistory}
                  className="text-xs font-bold text-blue-500 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1">
                {searchHistory.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <button 
                      onClick={() => {
                        setQuery(item);
                        handleSearch(item);
                      }}
                      className="flex items-center gap-3 flex-1 py-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Search size={16} />
                      <span>{item}</span>
                    </button>
                    <button 
                      onClick={() => removeFromHistory(item)}
                      className="p-2 text-black/20 dark:text-white/20 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentUsers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Recent Users</h2>
                <button 
                  onClick={clearUserHistory}
                  className="text-xs font-bold text-blue-500 hover:underline"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-4">
                {recentUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between group">
                    <button 
                      onClick={() => onNavigate(u.username)}
                      className="flex items-center gap-3 flex-1 hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-2xl transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                        {u.avatar && <img src={u.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{u.username}</div>
                        <div className="text-xs text-black/40 dark:text-white/40 line-clamp-1">{u.bio}</div>
                      </div>
                    </button>
                    <button 
                      onClick={() => removeFromUserHistory(u.id)}
                      className="p-2 text-black/20 dark:text-white/20 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {hasSearched ? (
        (results.users.length > 0 || results.tweets.length > 0) ? (
          <div className="space-y-8">
            {results.users.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-4">Users</h2>
                <div className="space-y-4">
                  {results.users.map(u => (
                    <button 
                      key={u.id} 
                      onClick={() => {
                        addToUserHistory(u);
                        onNavigate(u.username);
                      }}
                      className="flex items-center gap-3 w-full text-left hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-2xl transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                        {u.avatar && <img src={u.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
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
                  {results.tweets.map((t) => (
                    <TweetCard 
                      key={t.id} 
                      tweet={t} 
                      onLike={handleLike} 
                      onRetweet={handleRetweet} 
                      onReply={onReply} 
                      onNavigate={onNavigate} 
                      onViewTweet={onViewTweet} 
                      currentUserId={currentUserId} 
                      onDelete={onDelete} 
                      onImageClick={() => onViewTweet(t.retweet_id || t.id)}
                    />
                  ))}
                </div>
              </section>
            )}
            <div ref={lastResultRef} className="h-4" />
            {loadingMore && (
              <div className="p-4 text-center text-black/40 dark:text-white/40 text-sm">
                Loading more...
              </div>
            )}
          </div>
        ) : query.length >= 2 && (
          <div className="p-12 text-center text-black/40 dark:text-white/40">
            No results found for "{query}"
          </div>
        )
      ) : query.length >= 2 && (
        <div className="p-12 text-center text-black/40 dark:text-white/40">
          <p className="text-lg font-medium mb-2">Press Enter to search</p>
          <p className="text-sm">Or click the magnifier icon to confirm</p>
        </div>
      )}
    </div>
  );
}

function ProfileView({ username, isOwn, setView, onReply, onViewTweet, onDelete, currentUserId, refreshKey, onMessage }: { username: string, isOwn?: boolean, setView?: any, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, onDelete?: (id: number) => void, currentUserId?: number, refreshKey?: number, onMessage: (userId: number) => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const limit = 20;

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${username}`);
      const profileData = res.ok ? await res.json() : null;
      setProfile(profileData);
      
      // Initial tweets fetch
      const tweetsRes = await fetch(`/api/tweets/user/${username}?limit=${limit}&offset=0`);
      const tweetsData = tweetsRes.ok ? await tweetsRes.json() : [];
      const newTweets = Array.isArray(tweetsData) ? tweetsData : [];
      setTweets(newTweets);
      setHasMore(newTweets.length === limit);
      setOffset(newTweets.length);
    } catch (e) {
      console.error('Failed to load profile data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTweets = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/tweets/user/${username}?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        const newTweets = Array.isArray(data) ? data : [];
        setTweets(prev => [...prev, ...newTweets]);
        setHasMore(newTweets.length === limit);
        setOffset(prev => prev + newTweets.length);
      }
    } catch (e) {
      console.error('Failed to load more tweets:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [username, refreshKey]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTweetRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreTweets();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, offset, username]);

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/users/${profile.id}/follow`, { method: 'POST' });
      if (res.ok) {
        setProfile(prev => prev ? {
          ...prev,
          is_following: !prev.is_following,
          followers_count: prev.is_following ? prev.followers_count - 1 : prev.followers_count + 1
        } : null);
      }
    } catch (e) {
      console.error('Failed to follow user:', e);
    }
  };

  const handleBlock = async () => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/users/${profile.id}/block`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => prev ? {
          ...prev,
          is_blocked: data.isBlocked,
          is_following: data.isBlocked ? false : prev.is_following,
          followers_count: (data.isBlocked && prev.is_following) ? prev.followers_count - 1 : prev.followers_count
        } : null);
      }
    } catch (e) {
      console.error('Failed to block user:', e);
    }
  };

  const handleLike = async (id: number) => {
    try {
      await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to like tweet:', e);
    }
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
    try {
      await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to retweet:', e);
    }
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
            {profile.avatar && <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
          </div>
          {isOwn ? (
            <Button variant="secondary" onClick={() => setView('settings')}>
              <SettingsIcon size={20} />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={() => setShowBlockConfirm(true)}
                className={cn(profile.is_blocked && "text-red-500 border-red-500/20 bg-red-500/5")}
              >
                {profile.is_blocked ? <Shield size={20} /> : <Ban size={20} />}
              </Button>
              {!profile.is_blocked && (
                <Button 
                  variant="secondary"
                  onClick={() => onMessage(profile.id)}
                >
                  <MessageSquare size={20} />
                </Button>
              )}
              <Button 
                variant={profile.is_following ? 'secondary' : 'primary'}
                onClick={handleFollow}
                disabled={profile.is_blocked}
              >
                {profile.is_following ? 'Following' : 'Follow'}
              </Button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showBlockConfirm && (
            <ConfirmModal 
              title={profile.is_blocked ? "Unblock User?" : "Block User?"}
              message={profile.is_blocked 
                ? `They will be able to follow you and send you messages again.` 
                : `They will not be able to follow you, send you messages, or see your tweets.`}
              confirmText={profile.is_blocked ? "Unblock" : "Block"}
              isDestructive={!profile.is_blocked}
              onConfirm={() => {
                handleBlock();
                setShowBlockConfirm(false);
              }}
              onCancel={() => setShowBlockConfirm(false)}
            />
          )}
        </AnimatePresence>
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
        {tweets.map((t, index) => (
          <div key={t.id} ref={index === tweets.length - 1 ? lastTweetRef : null}>
            <TweetCard 
              tweet={t} 
              onLike={handleLike} 
              onRetweet={handleRetweet} 
              onReply={onReply} 
              onViewTweet={onViewTweet} 
              onDelete={onDelete} 
              currentUserId={currentUserId} 
              onImageClick={() => onViewTweet(t.retweet_id || t.id)}
            />
          </div>
        ))}
      </div>
      {loadingMore && (
        <div className="p-4 text-center text-black/40 dark:text-white/40 text-sm">
          Loading more...
        </div>
      )}
    </div>
  );
}

function UserListView({ username, type, onNavigate, onBack }: { username: string, type: 'followers' | 'following', onNavigate: (username: string) => void, onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchUsers = async (isInitial = false) => {
    if (!isInitial && (loadingMore || !hasMore)) return;

    if (isInitial) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offset;
      const res = await fetch(`/api/users/${username}/${type}?limit=${limit}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        const newUsers = Array.isArray(data) ? data : [];
        if (isInitial) {
          setUsers(newUsers);
        } else {
          setUsers(prev => [...prev, ...newUsers]);
        }
        setHasMore(newUsers.length === limit);
        setOffset(currentOffset + newUsers.length);
      }
    } catch (e) {
      console.error(`Failed to fetch ${type}:`, e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchUsers(true);
  }, [username, type]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastUserRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchUsers();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, offset, username, type]);

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
          {users.map((u, index) => (
            <div key={u.id} ref={index === users.length - 1 ? lastUserRef : null}>
              <button 
                onClick={() => onNavigate(u.username)}
                className="flex items-center gap-3 w-full text-left hover:bg-black/5 dark:hover:bg-white/5 p-4 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex-shrink-0">
                  {u.avatar && <img src={u.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <div className="font-bold truncate">{u.username}</div>
                    {u.tier === 0 && <CheckCircle2 size={14} className="text-blue-500" />}
                  </div>
                  <div className="text-sm text-black/40 dark:text-white/40 truncate">{u.bio}</div>
                </div>
              </button>
            </div>
          ))}
          {loadingMore && (
            <div className="p-4 text-center text-black/40 dark:text-white/40 text-sm">
              Loading more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TweetDetailView({ tweetId, onNavigate, onReply, onViewTweet, onBack, currentUserId, onDelete, refreshKey, onImageClick }: { tweetId: number, onNavigate: (username: string) => void, onReply: (t: Tweet) => void, onViewTweet: (id: number) => void, onBack: () => void, currentUserId?: number, onDelete?: (id: number) => void, refreshKey?: number, onImageClick?: (images: string[], index: number) => void }) {
  const [data, setData] = useState<{ tweet: Tweet, replies: Tweet[], parent?: Tweet } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [showExactDate, setShowExactDate] = useState(false);

  const loadTweetDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tweets/${tweetId}`);
      const d = res.ok ? await res.json() : null;
      
      if (d) {
        // Initial replies fetch
        const repliesRes = await fetch(`/api/tweets/${tweetId}/replies?limit=${limit}&offset=0`);
        const repliesData = repliesRes.ok ? await repliesRes.json() : [];
        const newReplies = Array.isArray(repliesData) ? repliesData : [];
        setData({ ...d, replies: newReplies });
        setHasMore(newReplies.length === limit);
        setOffset(newReplies.length);
      } else {
        setData(null);
      }
    } catch (e) {
      console.error('Failed to load tweet detail:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreReplies = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/tweets/${tweetId}/replies?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        const newReplies = Array.isArray(data) ? data : [];
        setData(prev => prev ? {
          ...prev,
          replies: [...prev.replies, ...newReplies]
        } : null);
        setHasMore(newReplies.length === limit);
        setOffset(prev => prev + newReplies.length);
      }
    } catch (e) {
      console.error('Failed to load more replies:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadTweetDetail();
  }, [tweetId, refreshKey]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastReplyRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreReplies();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, offset, tweetId]);

  const handleLike = async (id: number) => {
    try {
      await fetch(`/api/tweets/${id}/like`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to like tweet:', e);
    }
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
    try {
      await fetch(`/api/tweets/${id}/retweet`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to retweet:', e);
    }
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
            {data.tweet.avatar && <img src={data.tweet.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
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
        
        <ImageGrid 
          images={data.tweet.images || []} 
          onImageClick={(index) => onImageClick?.(data.tweet.images || [], index)} 
        />

        <button 
          onClick={() => setShowExactDate(!showExactDate)}
          className="text-sm text-black/40 dark:text-white/40 mb-4 pb-4 border-b border-black/5 dark:border-white/5 block w-full text-left hover:underline"
        >
          {showExactDate 
            ? formatTehranTime(data.tweet.created_at) 
            : formatRelativeTime(data.tweet.created_at)}
        </button>
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
        {data.replies.map((reply, index) => (
          <div key={reply.id} ref={index === data.replies.length - 1 ? lastReplyRef : null}>
            <TweetCard 
              tweet={reply} 
              onLike={handleLike} 
              onRetweet={handleRetweet} 
              onReply={onReply} 
              onNavigate={onNavigate} 
              onViewTweet={onViewTweet}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          </div>
        ))}
        {loadingMore && (
          <div className="p-4 text-center text-black/40 dark:text-white/40 text-sm">
            Loading more...
          </div>
        )}
      </div>
    </div>
  );
}

function CropperModal({ image, onCropComplete, onCancel }: { image: string, onCropComplete: (croppedImage: string, croppedImageSmall: string) => void, onCancel: () => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const handleCrop = async () => {
    try {
      const canvas = await getCroppedImgCanvas(image, croppedAreaPixels);
      if (!canvas) return;
      
      // Standard version
      const standardBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85));
      const standardFile = new File([standardBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const compressedStandard = await compressImage(standardFile, { maxWidthOrHeight: 400, maxSizeMB: 0.1 });
      const standardUrl = await fileToBase64(compressedStandard);

      // Small version
      const smallBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.6));
      const smallFile = new File([smallBlob], 'avatar_small.jpg', { type: 'image/jpeg' });
      const compressedSmall = await compressImage(smallFile, { maxWidthOrHeight: 100, maxSizeMB: 0.02 });
      const smallUrl = await fileToBase64(compressedSmall);

      onCropComplete(standardUrl, smallUrl);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex flex-col">
      <div className="flex justify-between p-4 text-white z-10">
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/10"><X size={24} /></button>
        <button onClick={handleCrop} className="px-6 py-2 bg-white text-black font-bold rounded-full">Apply</button>
      </div>
      <div className="relative flex-1">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
        />
      </div>
      <div className="p-8 bg-black/50 backdrop-blur-md">
        <input 
          type="range" 
          min={1} 
          max={3} 
          step={0.1} 
          value={zoom} 
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasNumber = /\d/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return pass.length >= minLength && hasNumber && hasSpecialChar;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== repeatPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Password must be at least 8 characters long and include at least one number and one special character.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Password updated successfully');
        onClose();
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-white/10 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-black w-full max-w-md rounded-3xl p-6 shadow-2xl border border-black/5 dark:border-white/5"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black">Change Password</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium px-1">Current Password</label>
            <Input 
              type="password" 
              placeholder="Enter current password" 
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium px-1">New Password</label>
            <Input 
              type="password" 
              placeholder="Enter new password" 
              value={newPassword}
              onChange={(e: any) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium px-1">Repeat New Password</label>
            <Input 
              type="password" 
              placeholder="Repeat new password" 
              value={repeatPassword}
              onChange={(e: any) => setRepeatPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs px-1">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

function SettingsView({ user, setView, onUpdateUser, onNewInvite, onLogout }: any) {
  const { toggleTheme } = useTheme();
  const [bio, setBio] = useState(user.bio || '');
  const [invites, setInvites] = useState<any[]>([]);
  const [quota, setQuota] = useState(user.invite_quota);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [avatarSmall, setAvatarSmall] = useState(user.avatar_small || '');
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        const [invitesRes, meRes] = await Promise.all([
          fetch('/api/invites'),
          fetch('/api/auth/me')
        ]);
        
        const invitesData = invitesRes.ok ? await invitesRes.json() : [];
        setInvites(invitesData);
        
        const meData = meRes.ok ? await meRes.json() : null;
        if (meData) {
          setQuota(meData.invite_quota);
          setBio(meData.bio || '');
          setAvatar(meData.avatar || '');
          setAvatarSmall(meData.avatar_small || '');
        }
      } catch (e) {
        console.error('Failed to load settings data:', e);
      }
    };
    loadSettingsData();
  }, []);

  const handleAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setCroppingImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (standard: string, small: string) => {
    setAvatar(standard);
    setAvatarSmall(small);
    setCroppingImage(null);
  };

  const generateInvite = async () => {
    try {
      const res = await fetch('/api/invites/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setInvites(prev => [...prev, { code: data.code, used_by_id: null }]);
        onNewInvite(data.code);
        if (user.tier === 1) setQuota(prev => prev - 1);
      }
    } catch (e) {
      console.error('Failed to generate invite:', e);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, avatar, avatar_small: avatarSmall })
      });
      if (res.ok) {
        onUpdateUser({ ...user, bio, avatar, avatar_small: avatarSmall });
        alert('Profile updated');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('profile')} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-black">Settings</h1>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </header>

      {croppingImage && (
        <CropperModal 
          image={croppingImage} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setCroppingImage(null)} 
        />
      )}

      {isChangingPassword && (
        <ChangePasswordModal onClose={() => setIsChangingPassword(false)} />
      )}

      <section className="space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-black/40 dark:text-white/40">Profile</h2>
        
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden border-4 border-white dark:border-black shadow-xl">
              {avatar ? (
                <img src={avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-black/20 dark:text-white/20">
                  <Camera size={32} />
                </div>
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
              <Camera className="text-white" size={24} />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
            </label>
          </div>
          <p className="text-xs text-black/40 dark:text-white/40">Tap to change profile picture</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium px-1">Biography</label>
            <textarea 
              className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border-none focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all resize-none h-24"
              placeholder="Tell the world about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <Button onClick={updateProfile} className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
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
        <Button variant="secondary" className="w-full flex justify-between items-center" onClick={() => setIsChangingPassword(true)}>
          <span>Change Password</span>
          <Lock size={20} />
        </Button>
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
              <button 
                key={inv.code} 
                onClick={() => !inv.used_by_id && copyToClipboard(inv.code)}
                className={cn(
                  "w-full flex justify-between p-3 rounded-xl transition-all active:scale-95",
                  inv.used_by_id ? "bg-black/5 dark:bg-white/5 cursor-default" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                )}
              >
                <div className="flex flex-col items-start">
                  <span className="font-mono text-sm">{inv.code}</span>
                  {!inv.used_by_id && (
                    <span className="text-[10px] text-black/30 dark:text-white/30 uppercase tracking-tighter">
                      {copiedCode === inv.code ? "Copied!" : "Tap to copy"}
                    </span>
                  )}
                </div>
                <span className={inv.used_by_id ? "text-green-500 text-xs self-center" : "text-black/40 dark:text-white/40 text-xs self-center"}>
                  {inv.used_by_id ? "Used" : "Available"}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InviteCardModal({ code, onClose }: { code: string, onClose: () => void }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-white/20 backdrop-blur-md z-[200] flex items-center justify-center p-6 overflow-hidden">
      <motion.div 
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0, rotate: 180, opacity: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 100 }}
        className="relative w-full max-w-sm aspect-[1.6/1] perspective-1000 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", damping: 20 }}
          className="w-full h-full relative preserve-3d"
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-8 flex flex-col justify-between shadow-2xl border border-white/20">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 bg-white/20 rounded-full backdrop-blur-sm flex items-center justify-center">
                <Gift className="text-white" size={24} />
              </div>
              <div className="text-white/80 font-black tracking-tighter text-xl">JEAK</div>
            </div>
            <div className="space-y-1">
              <div className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-bold">Invite Reward</div>
              <div className="text-white text-2xl font-black">EXCLUSIVE ACCESS</div>
            </div>
          </div>

          {/* Back */}
          <motion.div 
            style={{ rotateY: 180 }}
            className="absolute inset-0 backface-hidden bg-white dark:bg-zinc-900 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl border border-black/5 dark:border-white/5"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            <div className="text-black/40 dark:text-white/40 text-[10px] uppercase tracking-[0.2em] font-bold mb-4">Your Invite Code</div>
            <div className="text-3xl font-mono font-black tracking-widest mb-2">{code}</div>
            <div className="text-[10px] text-black/20 dark:text-white/20 uppercase tracking-widest font-medium">
              {copied ? "Copied to clipboard!" : "Tap to copy"}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
      
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute bottom-12 text-white/60 hover:text-white text-sm font-medium transition-colors"
      >
        Close
      </motion.button>
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
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const maxLength = 250;
  const progress = Math.min((content.length / maxLength) * 100, 100);
  const isOverLimit = content.length > maxLength;

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 4 - images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    for (const file of filesToProcess) {
      try {
        const compressed = await compressImage(file as File, { maxWidthOrHeight: 1200, maxSizeMB: 0.5 });
        const base64 = await fileToBase64(compressed);
        setImages(prev => [...prev, base64]);
      } catch (err) {
        console.error('Compression failed', err);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!content.trim() && images.length === 0) || loading || isOverLimit) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          parent_id: replyTo?.id,
          images
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
          <div className="flex items-center gap-4">
            <div className="relative w-8 h-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  className="text-black/5 dark:text-white/5"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={88}
                  strokeDashoffset={88 - (88 * progress) / 100}
                  className={cn(
                    "transition-all duration-300",
                    isOverLimit ? "text-red-500" : content.length > maxLength - 20 ? "text-yellow-500" : "text-blue-500"
                  )}
                />
              </svg>
              {content.length > maxLength - 20 && (
                <span className={cn(
                  "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
                  isOverLimit ? "text-red-500" : "text-black/40 dark:text-white/40"
                )}>
                  {maxLength - content.length}
                </span>
              )}
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={(!content.trim() && images.length === 0) || loading || isOverLimit}
            >
              {loading ? 'Posting...' : (replyTo ? 'Reply' : 'Post')}
            </Button>
          </div>
        </div>
        
        {replyTo && (
          <div className="mb-4 p-3 rounded-2xl bg-black/5 dark:bg-white/5 text-sm text-black/60 dark:text-white/60">
            Replying to <span className="font-bold">@{replyTo.username}</span>
          </div>
        )}

        <textarea 
          autoFocus
          placeholder={replyTo ? "Post your reply" : "What's happening?"}
          className="w-full h-32 bg-transparent border-none outline-none text-xl resize-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {isOverLimit && (
          <p className="text-red-500 text-xs mb-2 font-medium">Character limit exceeded!</p>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-video rounded-2xl overflow-hidden bg-black/5 dark:bg-white/5">
                <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => removeImage(i)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-black/5 dark:border-white/5">
          <label className={cn(
            "p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors",
            images.length >= 4 && "opacity-50 cursor-not-allowed"
          )}>
            <ImageIcon size={20} className="text-blue-500" />
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleImageSelect}
              disabled={images.length >= 4}
            />
          </label>
        </div>
      </motion.div>
    </div>
  );
}

function MessagesView({ onNavigateChat }: { onNavigateChat: (userId: number) => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/messages/conversations');
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (e) {
        console.error('Failed to fetch conversations:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  return (
    <div>
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5">
        <h1 className="text-xl font-black">Messages</h1>
      </header>
      {loading ? (
        <div className="p-8 text-center text-black/40 dark:text-white/40">Loading conversations...</div>
      ) : conversations.length === 0 ? (
        <div className="p-12 text-center text-black/40 dark:text-white/40">
          <p className="text-lg font-medium mb-2">No messages yet</p>
          <p className="text-sm">Start a conversation from someone's profile!</p>
        </div>
      ) : (
        <div className="divide-y divide-black/5 dark:border-white/5">
          {conversations.map((conv) => (
            <button
              key={conv.other_user_id}
              onClick={() => onNavigateChat(conv.other_user_id)}
              className="flex items-center gap-3 w-full text-left hover:bg-black/5 dark:hover:bg-white/5 p-4 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex-shrink-0">
                {conv.avatar && <img src={conv.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-bold truncate">{conv.username}</div>
                  <div className="text-xs text-black/40 dark:text-white/40">{formatRelativeTime(conv.last_message_at)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-black/40 dark:text-white/40 truncate">{conv.last_message}</div>
                  {conv.unread_count > 0 && (
                    <div className="bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                      {conv.unread_count}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatRoomView({ otherUserId, currentUserId, onBack, onNavigateProfile, onImageClick }: { otherUserId: number, currentUserId: number, onBack: () => void, onNavigateProfile: (username: string) => void, onImageClick: (images: string[], index: number) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const limit = 30;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = async () => {
      const derivedKey = await deriveKey(currentUserId, otherUserId);
      setKey(derivedKey);
      fetchMessages(true, derivedKey);
    };
    initChat();
  }, [otherUserId]);

  const fetchMessages = async (isInitial = false, derivedKey?: CryptoKey) => {
    if (!isInitial && (loadingMore || !hasMore)) return;
    
    if (isInitial) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offset;
      const res = await fetch(`/api/messages/${otherUserId}?limit=${limit}&offset=${currentOffset}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setOtherUser(data.otherUser);
        setIsBlocked(data.isBlocked);
        
        const activeKey = derivedKey || key;
        const decryptedMessages = await Promise.all(data.messages.map(async (m: any) => ({
          ...m,
          content: await decryptMessage(m.content, activeKey!)
        })));

        if (isInitial) {
          setMessages(decryptedMessages);
        } else {
          setMessages(prev => [...decryptedMessages, ...prev]);
        }
        setHasMore(data.messages.length === limit);
        setOffset(currentOffset + data.messages.length);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSend = async (imageUrl?: string) => {
    if (!content.trim() && !imageUrl) return;
    if (!key) return;

    try {
      const encrypted = await encryptMessage(content || '', key);
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: otherUserId,
          content: encrypted,
          image_url: imageUrl
        })
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages(prev => [{ ...newMessage, content: content || '', is_read: 0 }, ...prev]);
        setContent('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send message');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const handleDelete = async (messageId: number) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (e) {
      console.error('Failed to delete message:', e);
    }
  };

  const handleBlock = async () => {
    try {
      const res = await fetch(`/api/users/${otherUserId}/block`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsBlocked(data.isBlocked);
        setShowBlockConfirm(false);
      }
    } catch (e) {
      console.error('Failed to block user:', e);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, { maxWidthOrHeight: 800, maxSizeMB: 0.2 });
      const base64 = await fileToBase64(compressed);
      handleSend(base64);
    } catch (e) {
      console.error('Failed to upload image:', e);
    }
  };

  const observer = useRef<IntersectionObserver | null>(null);
  const lastMessageRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchMessages();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, offset, otherUserId, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl z-30 p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
            <ArrowLeft size={20} />
          </button>
          {otherUser && (
            <button 
              onClick={() => onNavigateProfile(otherUser.username)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                {otherUser.avatar && <img src={otherUser.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
              </div>
              <div>
                <div className="font-bold text-sm">{otherUser.username}</div>
                <div className="text-[10px] text-black/40 dark:text-white/40 uppercase tracking-widest font-bold">
                  {isBlocked ? 'Blocked' : 'Direct Message'}
                </div>
              </div>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSearching(!isSearching)}
            className={cn("p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors", isSearching && "text-blue-500")}
          >
            <Search size={20} />
          </button>
          <button 
            onClick={() => setShowBlockConfirm(true)}
            className={cn("p-2 rounded-full hover:bg-red-500/10 transition-colors", isBlocked ? "text-red-500" : "text-black/40 dark:text-white/40")}
          >
            <Ban size={20} />
          </button>
        </div>
      </header>

      {isSearching && (
        <div className="p-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" size={18} />
            <input 
              autoFocus
              placeholder="Search messages..."
              className="w-full pl-12 pr-4 py-2 rounded-full bg-white dark:bg-black border border-black/5 dark:border-white/5 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchMessages(true)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-4">
        {loading ? (
          <div className="p-8 text-center text-black/40 dark:text-white/40">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-black/40 dark:text-white/40">
            <p className="text-lg font-medium mb-2">{searchQuery ? 'No results found' : 'No messages yet'}</p>
            <p className="text-sm">{searchQuery ? 'Try a different search term' : 'Say hello!'}</p>
          </div>
        ) : (
          <>
            {messages.map((m, index) => (
              <div 
                key={m.id} 
                ref={index === messages.length - 1 ? lastMessageRef : null}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  m.sender_id === currentUserId ? "self-end items-end" : "self-start items-start"
                )}
              >
                <div className={cn(
                  "p-3 rounded-2xl text-[15px] relative group",
                  m.sender_id === currentUserId 
                    ? "bg-black dark:bg-white text-white dark:text-black rounded-tr-none" 
                    : "bg-black/5 dark:bg-white/5 text-black dark:text-white rounded-tl-none"
                )}>
                  {m.image_url && (
                    <img 
                      src={m.image_url} 
                      alt="Shared image" 
                      className="rounded-xl mb-2 max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                      referrerPolicy="no-referrer"
                      onClick={() => onImageClick([m.image_url], 0)}
                    />
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  
                  {m.sender_id === currentUserId && (
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[10px] text-black/40 dark:text-white/40">
                    {formatRelativeTime(m.created_at)}
                  </span>
                  {m.sender_id === currentUserId && (
                    <div className="flex items-center">
                      {m.is_read ? (
                        <CheckCheck size={12} className="text-blue-500" />
                      ) : (
                        <Check size={12} className="text-black/40 dark:text-white/40" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="p-4 text-center text-black/40 dark:text-white/40 text-xs">
                Loading older messages...
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-black/5 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-xl sticky bottom-0">
        <div className="flex items-end gap-2">
          <label className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors flex-shrink-0">
            <ImageIcon size={20} className="text-blue-500" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <div className="flex-1 relative">
            <textarea 
              placeholder={isBlocked ? "You cannot message this user" : "Type a message..."}
              disabled={isBlocked}
              className="w-full px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all resize-none max-h-32 min-h-[48px]"
              rows={1}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <button 
            onClick={() => handleSend()}
            disabled={(!content.trim()) || isBlocked}
            className="p-3 rounded-full bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex-shrink-0"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showBlockConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-black p-6 rounded-3xl shadow-2xl max-w-sm w-full border border-black/5 dark:border-white/5"
            >
              <h3 className="text-xl font-black mb-2">{isBlocked ? 'Unblock' : 'Block'} {otherUser?.username}?</h3>
              <p className="text-black/60 dark:text-white/60 mb-6">
                {isBlocked 
                  ? 'They will be able to follow you and send you messages again.' 
                  : 'They will not be able to follow you, send you messages, or see your tweets.'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-black/5 dark:bg-white/5 font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBlock}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-bold text-white transition-colors",
                    isBlocked ? "bg-black dark:bg-white dark:text-black" : "bg-red-500 hover:bg-red-600"
                  )}
                >
                  {isBlocked ? 'Unblock' : 'Block'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthPage({ mode, setMode, onAuth }: any) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasNumber = /\d/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return pass.length >= minLength && hasNumber && hasSpecialChar;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (password !== repeatPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!validatePassword(password)) {
        setError('Password must be at least 8 characters long and include at least one number and one special character.');
        return;
      }
    }

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
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
    } catch (e) {
      setError('Network error. Please try again.');
      console.error('Auth failed:', e);
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
          
          <div className="relative">
            <Input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password} 
              onChange={(e: any) => setPassword(e.target.value)} 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {mode === 'register' && (
            <>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Repeat Password" 
                  value={repeatPassword} 
                  onChange={(e: any) => setRepeatPassword(e.target.value)} 
                />
              </div>
              <Input placeholder="Invite Code" value={inviteCode} onChange={(e: any) => setInviteCode(e.target.value)} />
            </>
          )}
          <Button className="w-full py-4 text-lg">{mode === 'login' ? 'Login' : 'Join Jeak'}</Button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setPassword('');
              setRepeatPassword('');
            }}
            className="text-sm font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
          >
            {mode === 'login' ? "Don't have an invite? Join waitlist" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
