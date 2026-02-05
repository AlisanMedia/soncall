import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'interactive' | 'highlighted';
    children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ variant = 'default', className = '', children, ...props }, ref) => {
        const baseClasses = 'glass-card rounded-2xl p-6';
        const variantClasses = {
            default: '',
            interactive: 'glass-card-hover cursor-pointer',
            highlighted: 'border-purple-500/30 glow-on-hover',
        };

        return (
            <div
                ref={ref}
                className={`${baseClasses} ${variantClasses[variant]} ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
    <div
        ref={ref}
        className={`flex flex-col space-y-1.5 ${className}`}
        {...props}
    />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className = '', ...props }, ref) => (
    <h3
        ref={ref}
        className={`text-2xl font-bold tracking-tight text-white ${className}`}
        {...props}
    />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className = '', ...props }, ref) => (
    <p
        ref={ref}
        className={`text-sm text-zinc-400 ${className}`}
        {...props}
    />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
    <div ref={ref} className={`pt-4 ${className}`} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
    <div
        ref={ref}
        className={`flex items-center pt-4 ${className}`}
        {...props}
    />
));
CardFooter.displayName = 'CardFooter';
