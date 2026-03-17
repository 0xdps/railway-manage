export default function BrandLogo({ size = 'md', showTagline = false, className = '' }) {
  const iconSrc = `${import.meta.env.BASE_URL}favicon.svg`;

  const sizes = {
    sm: { icon: 16, title: 12, subtitle: 10, gap: 8 },
    md: { icon: 20, title: 14, subtitle: 11, gap: 9 },
    lg: { icon: 24, title: 18, subtitle: 12, gap: 10 },
  };

  const cfg = sizes[size] || sizes.md;

  return (
    <div className={`brand-logo ${className}`.trim()}>
      <img
        src={iconSrc}
        alt="Railway Manage logo"
        width={32}
        height={32}
        className="brand-logo-mark"
      />
      <div className="brand-logo-copy">
        <p className="brand-logo-title" style={{ fontSize: cfg.title, letterSpacing: "0.01rem", fontWeight: 600, marginBottom: showTagline ? cfg.gap : 0 }}>
          Railway Manage
        </p>
        {showTagline ? (
          <p className="brand-logo-subtitle" style={{ fontSize: cfg.subtitle }}>
            control plane
          </p>
        ) : null}
      </div>
    </div>
  );
}