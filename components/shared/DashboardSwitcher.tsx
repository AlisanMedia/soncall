'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, User } from 'lucide-react';

interface DashboardSwitcherProps {
    role: string;
}

export default function DashboardSwitcher({ role }: DashboardSwitcherProps) {
    const pathname = usePathname();
    const isManager = pathname.startsWith('/manager');

    // Only show for admin/founder
    if (!['admin', 'founder'].includes(role)) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 bg-slate-800/60 backdrop-blur-sm rounded-lg p-1 border border-white/10">
            <Link
                href="/manager"
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 text-sm font-medium ${isManager
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                title="Yönetici Dashboard'a Geç"
            >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Yönetici</span>
            </Link>
            <Link
                href="/agent"
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 text-sm font-medium ${!isManager
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                title="Agent Dashboard'a Geç"
            >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Agent</span>
            </Link>
        </div>
    );
}
