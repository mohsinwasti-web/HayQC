import { Camera, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { api } from '@/lib/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB

interface PhotoCaptureProps {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  className?: string;
}

export function PhotoCapture({ label, value, onChange, className }: PhotoCaptureProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 6MB)');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.raw('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Upload failed');
      }

      const json = await response.json();
      const url = json.data?.url;

      if (url) {
        onChange(url);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  const getImageSrc = (imageValue: string): string => {
    if (imageValue.startsWith('/uploads/')) {
      return BACKEND_URL + imageValue;
    }
    return imageValue;
  };

  return (
    <div className={cn('relative', className)}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative aspect-square bg-muted rounded-xl overflow-hidden border-2 border-primary">
          <img
            src={getImageSrc(value)}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full shadow-md"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="absolute bottom-2 left-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
            {label}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isUploading}
          className={cn(
            'w-full aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 transition-colors',
            'hover:border-primary hover:bg-primary/5 active:scale-95',
            isUploading && 'animate-pulse bg-primary/10 cursor-wait',
            error && 'border-destructive bg-destructive/5'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm text-primary">Uploading...</span>
            </>
          ) : error ? (
            <>
              <Camera className="w-8 h-8 text-destructive" />
              <span className="text-sm text-destructive text-center px-2">{error}</span>
            </>
          ) : (
            <>
              <Camera className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{label}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
