"use client";

import { useCallback, useEffect, useState } from "react";
import SearchSelect from "./SearchSelect";
import {
  BLANK,
  buildBody,
  gmailUrl,
  greeting,
  mailtoUrl,
  opening,
  searchBills,
  searchLegislators,
  signature,
  subject,
  type LetterInput,
  type Position,
  type WriteBill,
  type WriteLegislator,
} from "../../lib/write-letter";

type Data = { bills: WriteBill[]; legislators: WriteLegislator[] };

const POSITIONS: { value: Position; label: string; active: string }[] = [
  { value: "support", label: "Support", active: "border-lowrisk bg-lowrisk text-white" },
  { value: "oppose", label: "Oppose", active: "border-ncred bg-ncred text-white" },
  { value: "info", label: "Just want info", active: "border-navy bg-navy text-white" },
];

// mailto links break in some email apps past roughly 2,000 characters.
const MAILTO_SAFE_LENGTH = 1900;

const inputClass =
  "mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy";

// Renders text with any "________" blanks in a muted color so unfilled parts of
// the letter read as placeholders.
function WithBlanks({ text }: { text: string }) {
  const parts = text.split(BLANK);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="text-navymuted">{BLANK}</span>}
        </span>
      ))}
    </>
  );
}

function StepHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-serif text-xl font-bold text-navy">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-navy font-mono text-sm text-white">
        {n}
      </span>
      {children}
    </h2>
  );
}

export default function WriteForm() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [legislator, setLegislator] = useState<WriteLegislator | null>(null);
  const [bill, setBill] = useState<WriteBill | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [place, setPlace] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    fetch("/api/write-data")
      .then((res) => {
        if (!res.ok) throw new Error("bad response");
        return res.json() as Promise<Data>;
      })
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(load, [load]);

  const input: LetterInput = { legislator, bill, position, place, anonymous, name, email, phone };

  const missing: string[] = [];
  if (!legislator) missing.push("a legislator");
  if (!bill) missing.push("a bill");
  if (!position) missing.push("whether you support, oppose, or want info");
  if (!anonymous && !name.trim()) missing.push("your name (or choose Anonymous)");
  const ready = missing.length === 0;

  const subj = subject(position, bill);
  const body = buildBody(input, message);
  const mailto = legislator ? mailtoUrl(legislator.email, subj, body) : "#";
  const gmail = legislator ? gmailUrl(legislator.email, subj, body) : "#";
  const tooLongForMailto = ready && mailto.length > MAILTO_SAFE_LENGTH;

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(
        `To: ${legislator?.email ?? ""}\nSubject: ${subj}\n\n${body}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the other two buttons still work.
    }
  }

  const actionBase =
    "inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold transition-colors";
  const actionOn = `${actionBase} bg-navy text-white hover:bg-navylight`;
  const actionOff = `${actionBase} cursor-not-allowed bg-gray-200 text-gray-500`;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* ---------------- Steps ---------------- */}
      <div className="space-y-8 lg:col-span-5">
        {loadError && (
          <div className="rounded-md border border-negborder bg-negbg p-4 text-sm text-ncred">
            Couldn&rsquo;t load the bill and legislator lists.{" "}
            <button type="button" onClick={load} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}

        <section className="space-y-4">
          <StepHeading n={1}>Who are you writing to?</StepHeading>
          <SearchSelect<WriteLegislator>
            label="Legislator"
            placeholder="Search by name or district number…"
            hint="Not sure who represents you? Look it up on the District Map."
            value={legislator}
            onChange={setLegislator}
            disabled={!data}
            search={(q) => searchLegislators(data?.legislators ?? [], q)}
            getKey={(l) => l.id}
            renderOption={(l) => (
              <span>
                <span className="font-medium">{l.name}</span>{" "}
                <span className="text-navymuted">
                  · {l.role === "Sen" ? "Senator" : "Representative"}
                  {l.district ? ` · District ${l.district}` : ""}
                  {l.party ? ` · ${l.party}` : ""}
                </span>
              </span>
            )}
            renderSelected={(l) => (
              <span>
                <span className="font-semibold">{l.name}</span>
                <span className="block text-xs text-navylight">
                  {l.role === "Sen" ? "Senator" : "Representative"}
                  {l.district ? ` · District ${l.district}` : ""}
                  {l.party ? ` · ${l.party}` : ""}
                </span>
              </span>
            )}
          />
        </section>

        <section className="space-y-4">
          <StepHeading n={2}>What&rsquo;s it about?</StepHeading>
          <SearchSelect<WriteBill>
            label="Bill"
            placeholder="Search by bill number or title…"
            hint="Try a bill number like H1006 or S445, or words from the title."
            value={bill}
            onChange={setBill}
            disabled={!data}
            search={(q) => searchBills(data?.bills ?? [], q)}
            getKey={(b) => b.id}
            renderOption={(b) => (
              <span className="flex items-baseline gap-2">
                <span className="flex-none font-mono text-xs font-semibold text-navy">{b.n}</span>
                <span className="line-clamp-2">{b.t}</span>
              </span>
            )}
            renderSelected={(b) => (
              <span>
                <span className="font-mono text-xs font-semibold">{b.n}</span>
                <span className="block text-sm">{b.t}</span>
              </span>
            )}
          />

          <div>
            <p className="text-sm font-semibold text-navy">Where do you stand?</p>
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Your position">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={position === p.value}
                  onClick={() => setPosition(p.value)}
                  className={`rounded-md border px-2 py-2.5 text-sm font-semibold transition-colors ${
                    position === p.value
                      ? p.active
                      : "border-gray-300 bg-white text-gray-700 hover:border-navy hover:text-navy"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <StepHeading n={3}>About you</StepHeading>

          <div>
            <p className="text-sm font-semibold text-navy">Sign your letter as</p>
            <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Signature">
              {[
                { anon: false, label: "My name" },
                { anon: true, label: "Anonymous" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={anonymous === opt.anon}
                  onClick={() => setAnonymous(opt.anon)}
                  className={`rounded-md border px-2 py-2.5 text-sm font-semibold transition-colors ${
                    anonymous === opt.anon
                      ? "border-navy bg-navy text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-navy hover:text-navy"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {anonymous && (
              <p className="mt-2 rounded-md bg-badge px-3 py-2 text-xs leading-relaxed text-navy">
                Heads up: this tool opens <em>your own</em> email app, which sends
                from your own address &mdash; so the legislator can still see it.
                &ldquo;Anonymous&rdquo; only leaves your name off the letter.
              </p>
            )}
          </div>

          {!anonymous && (
            <div>
              <label htmlFor="w-name" className="block text-sm font-semibold text-navy">
                Your name
              </label>
              <input
                id="w-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="w-place" className="block text-sm font-semibold text-navy">
              City or ZIP <span className="font-normal text-navymuted">(optional)</span>
            </label>
            <input
              id="w-place"
              type="text"
              autoComplete="address-level2"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Offices pay the most attention to their own constituents"
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="w-email" className="block text-sm font-semibold text-navy">
                Your email <span className="font-normal text-navymuted">(optional)</span>
              </label>
              <input
                id="w-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="w-phone" className="block text-sm font-semibold text-navy">
                Phone <span className="font-normal text-navymuted">(optional)</span>
              </label>
              <input
                id="w-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-navymuted">
            Email and phone only appear in your letter&rsquo;s signature if you
            fill them in, so the office can reply.
          </p>
        </section>
      </div>

      {/* ---------------- Letter ---------------- */}
      <div className="lg:col-span-7">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm lg:sticky lg:top-24">
          <div className="border-b border-gray-200 bg-pagebg px-6 py-4">
            <p className="section-label">Your letter</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-3">
                <dt className="w-16 flex-none text-navymuted">To</dt>
                <dd className="min-w-0 break-all text-navy">
                  {legislator ? legislator.email : <span className="text-navymuted">{BLANK}</span>}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 flex-none text-navymuted">Subject</dt>
                <dd className="min-w-0 text-navy">{subj}</dd>
              </div>
            </dl>
          </div>

          <div className="px-6 py-6 text-[15px] leading-relaxed text-gray-800">
            <p>
              <WithBlanks text={greeting(legislator)} />
            </p>
            <p className="mt-4">
              <WithBlanks text={opening(position, bill, place)} />
            </p>

            <label htmlFor="w-message" className="sr-only">
              Your message
            </label>
            <textarea
              id="w-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              maxLength={3000}
              placeholder="Write your message here — in your own words, say why this matters to you."
              className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2.5 text-[15px] text-gray-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />

            <p className="mt-4 whitespace-pre-line">
              <WithBlanks text={signature(input)} />
            </p>
          </div>

          <div className="border-t border-gray-200 px-6 py-5">
            <div className="flex flex-wrap gap-3">
              {ready ? (
                <a href={mailto} className={actionOn}>
                  Open in my email app
                </a>
              ) : (
                <button type="button" disabled className={actionOff}>
                  Open in my email app
                </button>
              )}
              {ready ? (
                <a href={gmail} target="_blank" rel="noopener noreferrer" className={actionOn}>
                  Open in Gmail
                </a>
              ) : (
                <button type="button" disabled className={actionOff}>
                  Open in Gmail
                </button>
              )}
              <button
                type="button"
                onClick={copyLetter}
                disabled={!ready}
                className={`${actionBase} border ${
                  ready
                    ? "border-navy text-navy hover:bg-badge"
                    : "cursor-not-allowed border-gray-200 text-gray-400"
                }`}
              >
                {copied ? "Copied!" : "Copy letter"}
              </button>
            </div>

            {!ready && (
              <p className="mt-3 text-xs text-navymuted">Still needed: {missing.join(", ")}.</p>
            )}
            {tooLongForMailto && (
              <p className="mt-3 text-xs text-navymuted">
                Long letter &mdash; if your email app cuts it off, use &ldquo;Open
                in Gmail&rdquo; or &ldquo;Copy letter&rdquo; instead.
              </p>
            )}
            <p className="mt-3 text-xs text-navymuted">
              NCPoliSearch never sees or stores your message. These buttons just
              open your email with the letter filled in, and you press send.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
