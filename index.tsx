
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-indigo-600 font-bold">جاري التحميل...</div>}>
      <App />
    </React.Suspense>
  </React.StrictMode>
);
