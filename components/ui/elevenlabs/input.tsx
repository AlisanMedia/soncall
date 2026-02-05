import React from 'react';

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={`
          flex h-12 w-full rounded-xl
          bg-white/5 backdrop-blur-sm
          border border-white/10
          px-4 py-3 text-base text-white
          placeholder:text-zinc-500
          focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50
          disabled:cursor-not-allowed disabled:opacity-50
          transition-smooth
          ${className}
        `}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = 'Input';

export { Input };
