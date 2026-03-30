'use client';

import React from 'react';

interface InputFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}

const InputField = ({ 
  id, 
  label, 
  type, 
  value, 
  onChange, 
  placeholder, 
  required = false 
}: InputFieldProps) => {
  return (
    <div>
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        /* Tailwind classes below handle:
           - Light mode: White bg, gray text, gray border
           - Dark mode: Dark gray bg, white text, darker border
        */
        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                   transition-all duration-200"
      />
    </div>
  );
};

export default InputField;