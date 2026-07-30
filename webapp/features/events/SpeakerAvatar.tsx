/** Speaker headshot, or a neutral grey silhouette when no photo is set. */
export function SpeakerAvatar({ photo, name, className = "speaker-photo-sm" }: { photo?: string; name?: string; className?: string }) {
  if (photo && photo.trim()) return <img className={className} src={photo} alt={name || "Speaker"} />;
  return (
    <span className={`${className} placeholder`} role="img" aria-label={name ? `${name} (no photo)` : "No speaker photo"}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
    </span>
  );
}
