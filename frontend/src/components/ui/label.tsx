import React, { LabelHTMLAttributes } from 'react';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

const Label: React.FC<LabelProps> = ({ children, className, ...props }) => {
  return (
    <label className={`block text-sm font-medium text-gray-700 mb-1 ${className || ''}`} {...props}>
      {children}
    </label>
  );
};

export { Label };
