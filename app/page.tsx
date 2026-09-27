import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import AsciiMurmur from "@/components/AsciiMurmur";
import Services from "@/components/Services";
import TryIt from "@/components/TryIt";

export const metadata: Metadata = {
  title: "starling — see the shape of your people",
};

const display = Fraunces({ subsets: ["latin"], weight: "700" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

export default function Home() {
  return (
    <main className={`${sans.className} min-h-dvh bg-[#F3EEE4] text-[#161A17] lowercase`}>
      <AsciiMurmur captionClassName={display.className} />
      <Services titleClassName={display.className} />
      <TryIt titleClassName={display.className} />
    </main>
  );
}
