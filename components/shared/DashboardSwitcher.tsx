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
        <div className="dashboard-switcher" aria-label="Dashboard seçimi">
            <Link
                href="/manager"
                className="dashboard-switcher-link"
                aria-current={isManager ? 'page' : undefined}
                title="Yönetici Dashboard'a Geç"
            >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Yönetici</span>
            </Link>
            <Link
                href="/agent"
                className="dashboard-switcher-link"
                aria-current={!isManager ? 'page' : undefined}
                title="Agent Dashboard'a Geç"
            >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Agent</span>
            </Link>
        </div>
    );
}
