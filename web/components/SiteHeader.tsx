"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTHOR } from "@/lib/site";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/how-it-works/", label: "How it works" },
];

export default function SiteHeader() {
  const path = usePathname() || "/";
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, ""));
  return (
    <header className="sitebar">
      <Link href="/" className="wordmark" aria-label="Sunburn, dashboard">
        <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="22" cy="32" r="11" fill="var(--sun)" />
          <path d="M38 18 A 20 20 0 0 1 38 46" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" />
          <path d="M47 11 A 30 30 0 0 1 47 53" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" strokeDasharray="6 7" />
        </svg>
        Sunburn
      </Link>
      <nav className="sitenav" aria-label="Pages">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <span className="byline">
        <a href={AUTHOR.url} rel="author">
          By <b>{AUTHOR.name}</b>
        </a>
        {AUTHOR.email && (
          <a href={`mailto:${AUTHOR.email}`} className="contact">
            Contact me
          </a>
        )}
      </span>
    </header>
  );
}
