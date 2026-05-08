"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: number;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt = "", fallback, size = 32, ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false);
    const showFallback = !src || imgError;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-white/5 border border-white/10",
          className,
        )}
        style={{ width: size, height: size }}
        {...props}
      >
        {!showFallback && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={alt}
            onError={() => setImgError(true)}
            className="aspect-square h-full w-full object-cover"
          />
        )}
        {showFallback && (
          <span className="flex h-full w-full items-center justify-center bg-[rgb(var(--color-primary))]/15 text-[rgb(var(--color-primary))] font-semibold text-xs">
            {fallback?.slice(0, 2).toUpperCase() || "?"}
          </span>
        )}
      </div>
    );
  },
);
Avatar.displayName = "Avatar";

export { Avatar };
