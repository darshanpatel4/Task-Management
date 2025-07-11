'use client';

import React from 'react';
import 'react-quill/dist/quill.snow.css'; // Import Quill's snow theme CSS
import type { UnprivilegedEditor } from 'react-quill';
import type { Sources } from 'quill';

// Dynamically import ReactQuill to ensure it's only loaded on the client side.
// This is the standard and correct way to handle components that are not SSR-compatible.
const ReactQuill = React.lazy(() => import('react-quill'));

interface RichTextEditorProps {
  value: string;
  onChange: (value: string, delta: any, source: Sources, editor: UnprivilegedEditor) => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = ({ value, onChange, placeholder, className }: RichTextEditorProps) => {
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

  return (
    <div className={className}>
      <React.Suspense fallback={<div>Loading editor...</div>}>
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          placeholder={placeholder}
        />
      </React.Suspense>
    </div>
  );
};

export default RichTextEditor;
