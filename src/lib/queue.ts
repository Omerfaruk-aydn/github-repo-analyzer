import { db } from "./db";
import { executeAnalysis } from "./worker";

let isWorkerLoopRunning = false;

export function startWorker() {
  if (isWorkerLoopRunning) return;
  isWorkerLoopRunning = true;
  
  console.log("[RepoMind Worker] Starting background worker loop...");
  
  setInterval(async () => {
    try {
      // Find a pending analysis job
      const pending = db.prepare("SELECT * FROM analyses WHERE status = 'pending' LIMIT 1").get() as any;
      if (pending) {
        // Mark as running
        db.prepare("UPDATE analyses SET status = 'cloning', started_at = ? WHERE id = ?")
          .run(new Date().toISOString(), pending.id);

        console.log(`[RepoMind Worker] Found pending job ${pending.id}. Launching...`);
        
        // Execute asynchronously so we don't block the loop
        executeAnalysis(pending.id).catch(err => {
          console.error(`[RepoMind Worker] Job ${pending.id} failed:`, err);
        });
      }
    } catch (error) {
      console.error("[RepoMind Worker] Error in worker loop:", error);
    }
  }, 2000);
}
