type Props = {
  className?: string;
  title?: string;
};

export default function JokerIcon({ className, title = "Comodín" }: Props) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>
      <path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3z" fill="currentColor" />
    </svg>
  );
}
