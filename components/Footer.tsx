import Link from "next/link";

const QUICK_LINKS = [
  { href: "/bills", label: "Bills" },
  { href: "/legislators", label: "Legislators" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "About" },
];

export default function Footer() {
  return (
    <footer className="mt-16 bg-navy text-white">
      {/* Gold hairline across the top — governmental accent. */}
      <div className="h-1 w-full bg-gradient-to-r from-gold via-goldlight to-gold" />

      <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-12 sm:grid-cols-3">
        {/* Left — logo + tagline. */}
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-badge font-mono text-sm font-bold text-navy">
              NC
            </span>
            <span className="font-serif text-lg font-bold text-white">
              NCPoliSearch
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-skyblue/80">
            Nonpartisan, plain-language analysis of North Carolina legislation.
          </p>
        </div>

        {/* Center — quick links. */}
        <div className="sm:text-center">
          <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-gold">
            Explore
          </h3>
          <ul className="mt-3 space-y-2">
            {QUICK_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-skyblue/90 transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Right — attributions. */}
        <div className="sm:text-right">
          <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-gold">
            Powered By
          </h3>
          <p className="mt-3 text-sm text-skyblue/90">
            Data provided by{" "}
            <Link
              href="https://legiscan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              LegiScan
            </Link>
          </p>
          <p className="mt-1 text-sm text-skyblue/90">
            AI powered by{" "}
            <Link
              href="https://www.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              Anthropic Claude
            </Link>
          </p>
        </div>
      </div>

      {/* Bottom credit bar. */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-1 px-6 py-5 text-center text-xs text-skyblue/70 sm:flex-row sm:justify-between sm:text-left">
          <span>
            A project of{" "}
            <span className="font-semibold text-skyblue">
              NC Youth Legislative Council
            </span>{" "}
            · Built by Shrenik Sridharala
          </span>
          <span className="font-mono">© 2026 NCPoliSearch</span>
        </div>
      </div>
    </footer>
  );
}
