import type { Metadata } from "next";
import Link from "next/link";
import WriteForm from "../../components/write/WriteForm";

export const metadata: Metadata = {
  title: "Write Your Legislator — NCPoliSearch",
  description:
    "Email your NC legislator about a specific bill. Pick the bill, say whether you support or oppose it, and we'll start the letter for you.",
};

export default function WritePage() {
  return (
    <main className="bg-pagebg">
      <section className="border-b-4 border-[#c9a84c] bg-navy">
        <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-6 sm:py-16">
          <h1 className="font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
            Write Your Legislator
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-skyblue sm:text-xl">
            Pick a bill, say where you stand, and we&rsquo;ll start the letter
            for you. You add your own words and press send.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 sm:py-12">
        <WriteForm />

        <p className="mt-12 text-center text-xs italic leading-relaxed text-gray-500">
          NCPoliSearch is nonpartisan and doesn&rsquo;t take positions on bills.
          This tool only helps you contact your representatives; the opinions in
          your letter are yours. Not sure who represents you?{" "}
          <Link href="/map" className="font-medium text-navy underline">
            Find your district
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
