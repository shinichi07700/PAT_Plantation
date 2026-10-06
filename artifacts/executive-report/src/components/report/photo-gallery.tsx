import { useState } from 'react';
import { Camera, ExternalLink, ChevronLeft, ChevronRight, X, PlayCircle, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export interface DriveMedia {
  id: string;
  originalUrl: string;
  primaryThumb: string;
  secondaryThumb: string;
  previewUrl: string;
  driveUrl: string;
}

export function parseDriveMedia(raw?: string): DriveMedia[] {
  if (!raw) return [];
  const urls = raw.split(/[\s,;]+/).filter((u) => u.trim().startsWith('http'));
  const list: DriveMedia[] = [];

  for (const url of urls) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const id = match[1];
      list.push({
        id,
        originalUrl: url,
        primaryThumb: `https://lh3.googleusercontent.com/d/${id}=w400`,
        secondaryThumb: `https://drive.google.com/thumbnail?id=${id}&sz=w400`,
        previewUrl: `https://lh3.googleusercontent.com/d/${id}=w1600`,
        driveUrl: `https://drive.google.com/file/d/${id}/view`,
      });
    }
  }

  return list;
}

function ThumbnailItem({
  item,
  index,
  total,
  onSelect,
}: {
  item: DriveMedia;
  index: number;
  total: number;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState(item.primaryThumb);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleError = () => {
    if (src === item.primaryThumb) {
      setSrc(item.secondaryThumb);
    } else {
      setFailed(true);
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-md border border-border/80 bg-muted/30 text-left transition hover:border-primary/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
      title={`View photo ${index + 1} of ${total}`}
      aria-label={`View photo ${index + 1} of ${total}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/60">
        {!loaded && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 animate-pulse text-muted-foreground">
            <Camera className="h-5 w-5 opacity-40" />
          </div>
        )}
        {!failed ? (
          <img
            src={src}
            alt={`Field documentation ${index + 1}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-xs text-muted-foreground">
            <Camera className="mb-1 h-5 w-5 opacity-50" />
            <span>Photo {index + 1}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
      </div>

      <div className="flex w-full items-center justify-between border-t border-border/60 bg-background/90 px-2 py-1 text-[11px]">
        <span className="text-muted-foreground truncate font-medium">Photo {index + 1}</span>
        <span className="text-[10px] text-muted-foreground/80 group-hover:text-primary">Expand</span>
      </div>
    </button>
  );
}

export function PhotoGallery({
  photosRaw,
  title,
  date,
}: {
  photosRaw?: string;
  title?: string;
  date?: string;
}) {
  const photos = parseDriveMedia(photosRaw);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const current = selectedIndex !== null ? photos[selectedIndex] : null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % photos.length);
    }
  };

  return (
    <div className="mt-4 border-t border-border/70 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Camera className="h-3.5 w-3.5 text-primary" />
          <span>Field Documentation & Photos ({photos.length})</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Click thumbnail to expand</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((item, idx) => (
          <ThumbnailItem
            key={item.id}
            item={item}
            index={idx}
            total={photos.length}
            onSelect={() => setSelectedIndex(idx)}
          />
        ))}
      </div>

      {/* Lightbox Preview Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 border-border shadow-2xl sm:rounded-lg">
          <DialogTitle className="sr-only">
            {title ? `${title} photo preview` : 'Photo preview'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Viewing image {selectedIndex !== null ? selectedIndex + 1 : 0} of {photos.length}
          </DialogDescription>

          {current && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/30">
                <div className="min-w-0 pr-4">
                  <div className="truncate text-xs font-semibold">{title || 'Field Documentation'}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {date ? `${date} • ` : ''}Photo {selectedIndex! + 1} of {photos.length}
                  </div>
                </div>
              </div>

              {/* Main Image View */}
              <div className="relative flex min-h-[300px] max-h-[75vh] items-center justify-center bg-black/90 p-2 sm:p-4">
                <img
                  src={current.previewUrl}
                  alt={`Field documentation ${selectedIndex! + 1}`}
                  className="max-h-[70vh] w-auto max-w-full object-contain rounded"
                  onError={(e) => {
                    // Fallback to secondary thumbnail or drive direct link
                    (e.currentTarget as HTMLImageElement).src = current.secondaryThumb;
                  }}
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition shadow focus:outline-none"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 transition shadow focus:outline-none"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Footer navigation bar if multiple photos */}
              {photos.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 border-t border-border bg-background/50 px-4 py-2 overflow-x-auto">
                  {photos.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      className={`h-10 w-10 flex-shrink-0 overflow-hidden rounded border transition ${
                        selectedIndex === idx
                          ? 'border-primary ring-2 ring-primary/40'
                          : 'border-border opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={p.primaryThumb}
                        alt={`Thumb ${idx + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = p.secondaryThumb;
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MediaBadges({
  videoUrl,
  gmapsUrl,
}: {
  videoUrl?: string;
  gmapsUrl?: string;
}) {
  if (!videoUrl && !gmapsUrl) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {gmapsUrl && (
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-border bg-background/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <MapPin className="h-3 w-3 text-red-500" />
          <span>View on Google Maps</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </a>
      )}
      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-border bg-background/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <PlayCircle className="h-3 w-3 text-primary" />
          <span>Watch Video (Drive)</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </a>
      )}
    </div>
  );
}
