'use client';

import { FC } from 'react';
import { toast } from 'react-hot-toast';

interface ShareButtonProps {
  percent: number;
}

/**
 * ShareButton component that copies the verdict and current URL to clipboard
 */
const ShareButton: FC<ShareButtonProps> = ({ percent }) => {
  const getVerdict = (): string => {
    if (percent > 0.15) {
      return '🔴 This rent is above market average';
    } else if (percent < -0.15) {
      return '🟢 This rent is below market average';
    } else {
      return '🟡 This rent is close to market average';
    }
  };

  const handleShare = async () => {
    try {
      const shareText = `${getVerdict()} - Check out my rental comparison on RentFair: ${window.location.href}`;
      await navigator.clipboard.writeText(shareText);
      toast.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="btn btn-primary"
      aria-label="Share result"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
        <polyline points="16 6 12 2 8 6"></polyline>
        <line x1="12" y1="2" x2="12" y2="15"></line>
      </svg>
      Share Result
    </button>
  );
};

export default ShareButton;