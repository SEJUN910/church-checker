'use client';

export default function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        {/* 물결 스타일 스피너 */}
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 mx-1 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0s' }}></div>
            <div className="w-3 h-3 mx-1 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 mx-1 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 mx-1 bg-blue-600 rounded-full animate-wave" style={{ animationDelay: '0.3s' }}></div>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600">잠시만 기다려주세요</p>
      </div>

      <style jsx>{`
        @keyframes wave {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-12px);
            opacity: 1;
          }
        }
        .animate-wave {
          animation: wave 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
