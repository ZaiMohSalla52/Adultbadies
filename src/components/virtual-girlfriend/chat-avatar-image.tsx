'use client';

import Image from 'next/image';

const isDataImageUrl = (url: string) => /^data:image\//i.test(url.trim());

export const ChatAvatarImage = ({
  src,
  alt,
  width,
  height,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
}) => {
  if (isDataImageUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} width={width} height={height} className={className} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      unoptimized={src.includes('modelslab')}
    />
  );
};