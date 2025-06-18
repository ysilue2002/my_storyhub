import React from 'react';

// Composant PlatformIcon
function PlatformIcon({ platform }) {
  const icons = {
    instagram: '📸',
    youtube: '🎥',
    tiktok: '🎵',
  };
  return <span>{icons[platform] || '🌐'}</span>;
}

export default function PostCard({ post, lang }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow hover:shadow-xl transition">
      <div className="flex items-center mb-3">
        <PlatformIcon platform={post.platform} />
        <span
          className={`${
            lang === 'ar'
              ? 'font-arabic text-right mr-2'
              : 'ml-2 font-medium'
          }`}
        >
          {post.user}
        </span>
      </div>

      {/* Image */}
      {post.type === 'image' && (
        <img src={post.content} alt="Contenu" className="w-full h-auto rounded" />
      )}

      {/* Vidéo */}
      {post.type === 'video' && (
        <div className="relative pb-[56.25%] h-0 overflow-hidden rounded">
          <iframe
            src={`${post.content}?autoplay=0`}
            title={post.user}
            className="absolute top-0 left-0 w-full h-full"
            allowFullScreen
          ></iframe>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-500 mt-2">{post.timestamp}</p>
    </div>
  );
}