import "../styles/globals.css";
import "../styles/bubbles.css";
import MainComponent from "../components/MainComponent";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata = {
  title: "Korn Ferry - Workforce 25 AI Companion",
  description:
    "Korn Ferry's survey of professionals around the world. It's designed to answer one simple questio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <MainComponent children={children} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
