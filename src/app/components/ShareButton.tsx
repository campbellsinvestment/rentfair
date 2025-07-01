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
      Share Result
    </button>
  );
};

export default ShareButton;