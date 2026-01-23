import { ChevronLeft, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  showInspector?: boolean;
  className?: string;
  rightAction?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  showBack = true,
  backPath,
  showInspector = true,
  className,
  rightAction,
}: HeaderProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      className={cn(
        'bg-primary text-primary-foreground px-4 py-3 safe-area-inset-top sticky top-0 z-50',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-sm opacity-80 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
          {showInspector && currentUser && (
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{currentUser.name.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
