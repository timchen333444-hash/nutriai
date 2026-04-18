import { NavLink } from 'react-router-dom';
import { CalendarDays, BookOpen, Sparkles, BarChart2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAlerts } from '../../context/AlertsContext';

const navItems = [
  { to: '/',         icon: CalendarDays, label: 'Today'    },
  { to: '/library',  icon: BookOpen,     label: 'Library'  },
  { to: '/ai-plan',  icon: Sparkles,     label: 'AI Plan'  },
  { to: '/insights', icon: BarChart2,    label: 'Insights' },
  { to: '/profile',  icon: User,         label: 'Profile'  },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { unreadCount } = useAlerts();

  const showAlertBadge = user?.alertSettings?.deficiencyAlerts && unreadCount > 0;

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white border-t border-gray-100 safe-bottom z-40"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[60px] ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-primary hover:bg-primary-light'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon size={28} strokeWidth={isActive ? 2.5 : 1.8} />
                  {to === '/insights' && showAlertBadge && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
                  )}
                </div>
                <span className={`text-[12px] font-semibold leading-none ${isActive ? 'text-white' : ''}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
