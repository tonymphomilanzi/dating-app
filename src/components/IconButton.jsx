import cn from 'classnames';
import React from 'react';
import Icon from './Icon.jsx';

export default function IconButton({
  icon,           // pass a component (e.g., Icons.Heart) or a React element
  onClick,
  size = 60,
  variant = 'primary', // primary | ghost | danger
  className,
  iconSize = 24,
}) {
  const v = {
    primary: 'bg-white text-brand-600 shadow-md',
    ghost: 'bg-white/80 backdrop-blur border border-white/60 shadow-sm',
    danger: 'bg-white text-red-500 shadow-md',
  }[variant];

  const content = React.isValidElement(icon)
    ? React.cloneElement(icon, { className: cn('w-6 h-6', icon.props.className) })
    : <Icon as={icon} size={iconSize} />;

  return (
    <button
      onClick={onClick}
      className={cn('rounded-full flex items-center justify-center', v, className)}
      style={{ width: size, height: size }}
    >
      {icon ? content : <span />}
    </button>
  );
}