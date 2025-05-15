import { Quicksand } from "next/font/google";
import "./globals.css";
import { ThemeProviderClientComponent } from "../components/ThemeProviderClientComponent";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata = {
  title: "AI Chat App",
  description: "Chat with an AI, built with Next.js and Vercel AI SDK",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${quicksand.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProviderClientComponent
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProviderClientComponent>
      </body>
    </html>
  );
}
