import React from 'react';

const MessageSkeleton: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full skeleton"></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 skeleton rounded"></div>
              <div className="h-3 w-16 skeleton rounded"></div>
            </div>
            <div className="space-y-1">
              <div className="h-4 w-full skeleton rounded"></div>
              <div className="h-4 w-3/4 skeleton rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageSkeleton;