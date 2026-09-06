import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
        const variantClasses = {
            primary: 'ui-button-primary',
            secondary: 'ui-button-secondary',
            outline: 'ui-button-outline',
            ghost: 'ui-button-ghost',
            danger: 'ui-button-danger',
        };

        const sizeClasses = {
            sm: 'ui-button-sm',
            md: 'ui-button-md',
            lg: 'ui-button-lg',
            icon: 'ui-button-icon',
        };

        const baseClasses = 'ui-button disabled:pointer-events-none disabled:opacity-50';

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
