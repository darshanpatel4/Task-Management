'use client';

import React, { useState, useEffect } from 'react';
import 'react-quill/dist/quill.snow.css';
import dynamic from 'next/dynamic';

// Dynamically import ReactQuill with SSR turned off.
// This is crucial for components that are not compatible with server-side rendering.
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = ({ value, onChange, placeholder, className }: RichTextEditorProps) => {
  const [isMounted, setIsMounted] = useState(false);

  // This useEffect hook ensures that the component only renders on the client side.
  // The 'isMounted' state will be false on the server and true on the client after mounting.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      ['clean']
    ],
  };

  // Only render the ReactQuill component if we are on the client side.
  if (!isMounted) {
    // You can render a placeholder or loader here while the component is mounting.
    return (
        <div className="flex justify-center items-center h-40 border rounded-md bg-muted/50">
            <p>Loading Editor...</p>
        </div>
    );
  }

  return (
    <div className={className}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
      />
    </div>
  );
};

export default RichTextEditor;
