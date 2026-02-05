interface StatusIndicatorProps {
    isOnline: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ isOnline, size = 'sm' }: StatusIndicatorProps) {
    if (!isOnline) return null;

    const sizeClasses = {
        sm: 'w-2.5 h-2.5',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    return (
        <div className="absolute top-0 right-0 flex items-center justify-center">
            <div className="relative">
                {/* Pulsing outer ring */}
                <div className={`absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75 ${sizeClasses[size]}`} />
                {/* Solid inner dot */}
                <div className={`relative bg-green-500 rounded-full border-2 border-white shadow-lg ${sizeClasses[size]}`} />
            </div>
        </div>
    );
}

// Helper function to check if agent is online (active within last 5 minutes)
export function isAgentOnline(lastActivityTimestamp?: string | null): boolean {
    if (!lastActivityTimestamp) return false;

    const now = new Date();
    const lastActivity = new Date(lastActivityTimestamp);
    const diffMs = now.getTime() - lastActivity.getTime();
    const fiveMinutesInMs = 5 * 60 * 1000;

    return diffMs < fiveMinutesInMs;
}
