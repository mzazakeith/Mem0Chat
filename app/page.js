'use client';

import Link from 'next/link';
import { MessageSquareText, Brain, Zap } from 'lucide-react'; // Or other relevant icons

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 font-sans">
      <main className="text-center space-y-8 max-w-2xl">
        <header className="space-y-4">
          <div className="inline-block p-4 bg-primary/10 rounded-full">
            <MessageSquareText size={48} className="text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Welcome to <span className="text-primary">Mem0Chat</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Experience intelligent conversations with an AI that remembers you. Powered by Mem0.ai, Mem0Chat offers a personalized chat experience like never before.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="bg-card p-6 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <Brain size={24} className="text-primary mr-3" />
              <h3 className="text-lg font-semibold text-card-foreground">Persistent Memory</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Engage in conversations where the AI recalls past details and preferences, thanks to Mem0.ai integration.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center mb-3">
              <Zap size={24} className="text-primary mr-3" />
              <h3 className="text-lg font-semibold text-card-foreground">Dynamic & Configurable</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose from various AI models and enjoy a chat experience that adapts to your needs, with features like automatic title generation.
            </p>
          </div>
        </section>

        <div>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-primary-foreground bg-primary rounded-lg shadow-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-colors duration-150"
          >
            Start Chatting
          </Link>
        </div>
      </main>

      <footer className="py-8 mt-12 text-center">
        <p className="text-sm text-muted-foreground">
          Mem0Chat - The future of personalized AI conversations.
        </p>
      </footer>
    </div>
  );
}
