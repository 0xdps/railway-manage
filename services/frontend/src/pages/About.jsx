import { useEffect, useState } from 'react';
import { Database, Package, Shield, RefreshCw, GitBranch, Layers, Star, GitPullRequest, Code2, Github } from 'lucide-react';

const TOC = [
  { id: 'story',     label: 'The Story' },
  { id: 'features',  label: 'What it does' },
  { id: 'developer', label: 'The Developer' },
  { id: 'support',   label: 'Support the Project' },
];

const FEATURES = [
  {
    icon: Database,
    title: 'Automated backups',
    body: 'Scheduled backup jobs for Postgres, MySQL, and Redis services on Railway — hourly, daily, weekly, or monthly.',
  },
  {
    icon: Package,
    title: 'gzip compression',
    body: 'Every dump is compressed with gzip before being written to disk, keeping storage costs low.',
  },
  {
    icon: Shield,
    title: 'Zero credential storage',
    body: 'Database URLs are fetched live from Railway env vars at run time. Nothing is ever written to disk.',
  },
  {
    icon: Layers,
    title: 'Retention policies',
    body: "Auto-prune old backups per service and schedule so your volume never fills up silently.",
  },
  {
    icon: RefreshCw,
    title: 'Restart monitoring',
    body: "Watches for unhealthy Railway services and can trigger controlled restarts to keep your app online.",
  },
  {
    icon: GitBranch,
    title: 'Railway GraphQL native',
    body: "Connects directly to the Railway GraphQL API — no third-party service, no data leaves your account.",
  },
];

export default function About() {
  const [activeSection, setActiveSection] = useState('story');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-layout page-body--docs">

      {/* Sticky TOC */}
      <nav className="docs-toc">
        <div className="docs-toc-label">On this page</div>
        {TOC.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className={activeSection === id ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>

      {/* Main content */}
      <div className="about-page">

        {/* The Story */}
        <section className="about-section" id="story">
          <div className="about-section-eyebrow">The Story</div>
          <h2 className="about-section-title">
            It started with an AI script that deleted my database.
          </h2>
          <div className="about-prose">
            <p>
              I was setting up a new project and asked an AI assistant to write a provisioning
              script — one that would create infrastructure on Railway: a database, a cache
              service, environment variables, the works. The script had error handling: if anything
              broke during setup, it would roll back and remove everything it had just created.
            </p>
            <p>
              The rollback logic didn't distinguish between resources the script had created and
              resources that already existed. When a step failed mid-run, the cleanup swept through
              and deleted my existing database along with the new ones. Real data. Gone.
            </p>
            <p>
              Railway couldn't restore it at the time. There was no self-managed backup, no recent
              dump I could reach for. Just a missing table and a sinking feeling.
            </p>
            <p>
              That's when the idea crystallised:{' '}
              <em>backups should be under my control, not delegated to the platform.</em> If I have
              my own backup pipeline running inside my Railway account — writing dumps to a mounted
              volume, running on a schedule — then no script error, no platform incident, no
              accidental delete can take that away from me.
            </p>
            <p>
              railway-manage was built from that need. One weekend of coding turned into a full
              backup control plane: scheduled jobs, per-service configuration, retention cleanup,
              restart monitoring, and an audit trail of every operation. If you're reading this, I
              hope it means you never have to find out the hard way why this matters.
            </p>
          </div>
        </section>

        {/* What it does */}
        <section className="about-section" id="features">
          <div className="about-section-eyebrow">What it does</div>
          <div className="about-features-grid">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="about-feature-card">
                <div className="about-feature-icon"><Icon size={16} /></div>
                <div className="about-feature-title">{title}</div>
                <div className="about-feature-body">{body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* The Developer */}
        <section className="about-section" id="developer">
          <div className="about-section-eyebrow">The Developer</div>
          <div className="about-dev-card">
            <img
              src="https://github.com/0xdps.png"
              alt="Devendra Pratap Singh"
              className="about-dev-avatar"
              width={64}
              height={64}
              loading="lazy"
            />
            <div className="about-dev-info">
              <div className="about-dev-name">Devendra Pratap Singh</div>
              <div className="about-dev-handle">@0xdps</div>
              <p className="about-dev-bio">
                Builder of tools that stay out of your way. When something breaks in production
                and you wish you had a backup, I've usually already been there.
              </p>
              <div className="about-dev-links">
                <a
                  href="https://github.com/0xdps"
                  className="about-dev-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github size={13} />
                  GitHub
                </a>
                <a
                  href="https://github.com/0xdps/railway-manage"
                  className="about-dev-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Code2 size={13} />
                  Source Code
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Support the Project */}
        <section className="about-section" id="support">
          <div className="about-section-eyebrow">Support the Project</div>
          <h2 className="about-section-title">If this saved your data, pay it forward.</h2>
          <div className="about-prose">
            <p>
              railway-manage is free, open-source, and will stay that way. If it's keeping your
              data safe, the best things you can do are:
            </p>
          </div>
          <div className="about-support-grid">
            <a
              href="https://github.com/0xdps/railway-manage"
              className="about-support-card"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="about-support-icon"><Star size={20} /></div>
              <div className="about-support-title">Star on GitHub</div>
              <div className="about-support-body">
                A star helps others discover the project and shows that active users find it worth
                maintaining. It's the single highest-value thing you can do.
              </div>
              <div className="about-support-action">Star the repo ↗</div>
            </a>
            <a
              href="https://github.com/0xdps/railway-manage/issues"
              className="about-support-card"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="about-support-icon"><GitPullRequest size={20} /></div>
              <div className="about-support-title">File a bug or idea</div>
              <div className="about-support-body">
                Found something broken or have a feature that would fit your workflow? Open an
                issue — all feedback is read.
              </div>
              <div className="about-support-action">Open an issue ↗</div>
            </a>
            <div className="about-support-card about-support-card-muted">
              <div className="about-support-icon"><Code2 size={20} /></div>
              <div className="about-support-title">Contribute</div>
              <div className="about-support-body">
                PRs are welcome. Fork the repo, make your change, and open a pull request. Check
                open issues for things that need a hand.
              </div>
              <div className="about-support-action">Fork &amp; contribute</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
