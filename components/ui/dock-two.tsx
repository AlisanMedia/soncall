import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface DockProps {
    className?: string
    items: {
        icon: LucideIcon
        label: string
        onClick?: () => void
        active?: boolean
    }[]
}

interface DockIconButtonProps {
    icon: LucideIcon
    label: string
    onClick?: () => void
    active?: boolean
    className?: string
}


const DockIconButton = React.forwardRef<HTMLButtonElement, DockIconButtonProps>(
    ({ icon: Icon, label, onClick, active, className }, ref) => {
        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClick}
                className={cn(
                    "relative group p-3 rounded-lg",
                    "transition-all duration-200",
                    active
                        ? "bg-purple-500/30 text-white shadow-lg shadow-purple-500/20"
                        : "hover:bg-white/10 text-purple-200",
                    className
                )}
            >
                <Icon className="w-5 h-5" />
                <span className={cn(
                    "absolute top-14 left-1/2 -translate-x-1/2",
                    "px-2 py-1 rounded text-xs",
                    "bg-slate-800 text-white border border-white/10",
                    "opacity-0 group-hover:opacity-100",
                    "transition-opacity whitespace-nowrap pointer-events-none",
                    "shadow-xl z-50"
                )}>
                    {label}
                </span>
            </motion.button>
        )
    }
)
DockIconButton.displayName = "DockIconButton"

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
    ({ items, className }, ref) => {
        return (
            <div ref={ref} className={cn("w-full flex items-center justify-center py-4", className)}>
                <motion.div
                    animate={{
                        y: [-2, 2, -2],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className={cn(
                        "flex items-center gap-1 p-2 rounded-2xl",
                        "backdrop-blur-lg border shadow-2xl",
                        "bg-white/5 border-white/10",
                        "hover:shadow-purple-500/20 transition-shadow duration-300"
                    )}
                >
                    {items.map((item) => (
                        <DockIconButton key={item.label} {...item} />
                    ))}
                </motion.div>
            </div>
        )
    }
)
Dock.displayName = "Dock"

export { Dock }
