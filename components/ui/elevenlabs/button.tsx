import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
        const variantClasses = {
            primary: 'btn-primary-gradient text-white hover:shadow-lg',
            secondary: 'btn-ghost hover:bg-white/10',
            outline: 'border border-white/20 bg-transparent hover:bg-white/5 text-white',
            ghost: 'hover:bg-white/5 text-white',
            danger: 'bg-red-600 text-white hover:bg-red-700',
        };

        const sizeClasses = {
            sm: 'h-9 px-4 text-sm rounded-lg',
            md: 'h-11 px-6 text-base rounded-xl',
            lg: 'h-14 px-8 text-lg rounded-xl',
            icon: 'h-10 w-10 rounded-lg',
        };

        const baseClasses = 'inline-flex items-center justify-center font-semibold transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

        return (
            <button
                className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button };
