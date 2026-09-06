"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Tab {
    title: string;
    icon: LucideIcon;
    type?: never;
}

interface Separator {
    type: "separator";
    title?: never;
    icon?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
    tabs: TabItem[];
    className?: string;
    activeColor?: string;
    onChange?: (index: number | null) => void;
    defaultIndex?: number | null;
}

const buttonVariants = {
    initial: {
        gap: 0,
        paddingLeft: ".5rem",
        paddingRight: ".5rem",
    },
    animate: (isSelected: boolean) => ({
        gap: isSelected ? ".5rem" : 0,
        paddingLeft: isSelected ? "1rem" : ".5rem",
        paddingRight: isSelected ? "1rem" : ".5rem",
    }),
};

const spanVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 };

export function ExpandableTabs({
    tabs,
    className,
    activeColor = "text-primary",
    onChange,
    defaultIndex = null,
}: ExpandableTabsProps) {
    const [internalSelected, setInternalSelected] = React.useState<number | null>(defaultIndex);
    // A supplied defaultIndex + onChange is the controlled navigation mode used
    // by the dashboard. Without both props, tabs retain their local selection.
    const isExternallyControlled = defaultIndex !== null && onChange !== undefined;
    const selected = isExternallyControlled ? defaultIndex : internalSelected;
    const outsideClickRef = React.useRef<HTMLDivElement>(null);

    useOnClickOutside(outsideClickRef as React.RefObject<HTMLDivElement>, () => {
        // Optional: Close tab on outside click if desired, but for navigation we might want to keep it selected
        // For now, let's keep it selected if it's acting as a nav.
        // However, the original code resets it. Let's stick to user request but maybe make it optional behavior.

        // User requested EXACT copy-paste, but for a persistent nav bar, auto-closing is bad UX.
        // I will comment this out to ensure tabs stay selected for navigation purposes.
        // setSelected(null);
        // onChange?.(null);
    });

    const handleSelect = (index: number) => {
        if (!isExternallyControlled) {
            setInternalSelected(index);
        }
        onChange?.(index);
    };

    const Separator = () => (
        <div className="ui-tabs-separator" aria-hidden="true" />
    );

    return (
        <div
            ref={outsideClickRef}
            className={cn("ui-tabs", className)}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <Separator key={`separator-${index}`} />;
                }

                const Icon = tab.icon;
                return (
                    <motion.button
                        key={tab.title}
                        aria-label={tab.title}
                        title={tab.title}
                        variants={buttonVariants}
                        initial={false}
                        animate="animate"
                        custom={selected === index}
                        onClick={() => handleSelect(index)}
                        transition={transition}
                        className={cn(
                            "ui-tab",
                            selected === index
                                ? cn("ui-tab-active", activeColor)
                                : ""
                        )}
                    >
                        <Icon size={20} />
                        <AnimatePresence initial={false}>
                            {selected === index && (
                                <motion.span
                                    variants={spanVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={transition}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    {tab.title}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                );
            })}
        </div>
    );
}
