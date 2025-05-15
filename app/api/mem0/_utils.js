import { MemoryClient } from 'mem0ai';

let mem0ClientInstance;

export function getMem0Client() {
  if (!mem0ClientInstance) {
    if (!process.env.MEM0_API_KEY) {
      throw new Error("MEM0_API_KEY is not set in environment variables. Please ensure it is set in your .env.local file.");
    }
    // For Mem0 Platform (Cloud)
    mem0ClientInstance = new MemoryClient({ apiKey: process.env.MEM0_API_KEY, projectId: process.env.MEM0_PROJECT_ID });
    // For Mem0 Open Source (Self-Hosted) - if switching later
    // mem0ClientInstance = new Memory(); 
  }
  return mem0ClientInstance;
} 