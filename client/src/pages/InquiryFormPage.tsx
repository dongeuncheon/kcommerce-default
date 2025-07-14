import React from 'react';
import { InquiryForm } from '../components/inquiry/InquiryForm';

export function InquiryFormPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <InquiryForm />
      </div>
    </div>
  );
}