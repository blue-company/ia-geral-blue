import React, { ChangeEvent, KeyboardEvent, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PhoneInput({ value, onChange, className, ...props }: PhoneInputProps) {
  // Internal state to manage the input value
  const [inputValue, setInputValue] = useState<string>(value || '');

  // Update internal state when the external value changes
  useEffect(() => {
    if (value !== undefined) {
      setInputValue(formatPhoneNumber(value));
    }
  }, [value]);

  // Format the phone number as (XX) XXXXX-XXXX
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit to maximum 11 digits (2 for area code + 9 for the number)
    const limitedDigits = digits.slice(0, 11);
    
    // Format the number
    if (limitedDigits.length === 0) {
      return '';
    } else if (limitedDigits.length <= 2) {
      return `(${limitedDigits}`;
    } else if (limitedDigits.length <= 7) {
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
    } else {
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`;
    }
  };

  // Handle key presses to only allow numeric input
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Allow: Delete, Backspace, Tab, Escape, Enter, navigation keys
    if ([46, 8, 9, 27, 13, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) || 
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
      // Allow these keys
      return;
    }
    
    // Block any key that isn't a number
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && 
        (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Get the raw value from the input
    const rawValue = e.target.value;
    
    // Format the value
    const formattedValue = formatPhoneNumber(rawValue);
    
    // Update internal state
    setInputValue(formattedValue);
    
    // Create a new event with the formatted value
    const newEvent = {
      ...e,
      target: {
        ...e.target,
        value: formattedValue
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    // Call the original onChange if provided
    if (onChange) {
      onChange(newEvent);
    }
  };

  // Handle paste events to filter non-digit characters
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('Text');
    
    // Format the pasted value
    const formattedValue = formatPhoneNumber(pastedText);
    
    // Prevent the default paste
    e.preventDefault();
    
    // Update the input value manually
    setInputValue(formattedValue);
    
    // Create and dispatch a synthetic change event
    if (onChange) {
      const syntheticEvent = {
        target: {
          name: e.currentTarget.name,
          value: formattedValue
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      onChange(syntheticEvent);
    }
  };

  // Important: use the internal state for the component's value
  return (
    <Input
      type="tel"
      inputMode="numeric"
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={className}
      pattern="^\(\d{2}\) \d{5}-\d{4}$"
      minLength={15} // Format length: (XX) XXXXX-XXXX = 15 chars
      maxLength={15}
      placeholder="(XX) XXXXX-XXXX"
      {...props}
    />
  );
}
