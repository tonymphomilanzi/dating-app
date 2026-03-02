import React from 'react';
import cn from 'classnames';

export function Icon({ as, size = 24, className = '', ...rest }) {
  if (!as) return null;

  // If you pass a React element, clone it (keeps flexibility)
  if (React.isValidElement(as)) {
    return React.cloneElement(as, {
      className: cn('inline-block leading-none', className, as.props.className),
      style: { ...(as.props.style || {}), fontSize: size },
      ...rest,
    });
  }

  // If you pass a string, treat it as a Lineicons name: "heart", "close", etc.
  if (typeof as === 'string') {
    return (
      <i
        className={cn(`lni lni-${as}`, 'inline-block leading-none', className)}
        style={{ fontSize: size }}
        {...rest}
      />
    );
  }

  // If you pass a component function/class
  const Comp = as;
  return <Comp size={size} className={className} {...rest} />;
}