'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css'; // Import Quill's snow theme CSS

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Dynamically import ReactQuill to ensure it's only loaded on the client side
const ReactQuill = useMemo(() => dynamic(() => import('react-quill'), { ssr: false }), []);

// Use React.forwardRef to pass a ref to the underlying ReactQuill component.
// This is the recommended fix for the "findDOMNode is not a function" error in React 18+.
const RichTextEditor = React.forwardRef<any, RichTextEditorProps>(
  ({ value, onChange, placeholder, className }, ref) => {
    const modules = {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        [{ 'size': ['small', false, 'large', 'huge'] }], // Font size
        ['bold', 'italic', 'underline', 'strike'], // Toggled buttons
        [{ 'color': [] }, { 'background': [] }], // Font and background color
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }], // Outdent/indent
        ['link'],
        ['clean'] // Remove formatting
      ],
    };

    return (
      <div className={className}>
        <ReactQuill
          ref={ref}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          placeholder={placeholder}
        />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;