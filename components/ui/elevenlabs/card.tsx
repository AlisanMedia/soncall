import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'interactive' | 'highlighted';
    children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ variant = 'default', className = '', children, ...props }, ref) => {
        const baseClasses = 'glass-card ui-card rounded-2xl p-6';
        const variantClasses = {
            default: '',
            interactive: 'glass-card-hover ui-card-interactive',
            highlighted: 'ui-card-highlighted glow-on-hover',
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
        className={`ui-card-header ${className}`}
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
        className={`ui-card-title ${className}`}
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
        className={`ui-card-description ${className}`}
        {...props}
    />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
    <div ref={ref} className={`ui-card-content ${className}`} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className = '', ...props }, ref) => (
    <div
        ref={ref}
        className={`ui-card-footer ${className}`}
        {...props}
    />
));
CardFooter.displayName = 'CardFooter';
