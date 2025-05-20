import { NextRequest } from 'next/server';
import { jobStore } from '../../route';
import fs from 'fs';
import path from 'path';

// Fresh load of job store to ensure we get the latest data
function getLatestJobData(jobId: string) {
  try {
    // Read directly from the job store file to get the freshest data
    const jobStorePath = path.join(process.cwd(), 'job-store.json');
    if (fs.existsSync(jobStorePath)) {
      const data = fs.readFileSync(jobStorePath, 'utf8');
      const jobs = JSON.parse(data);
      return jobs[jobId];
    }
  } catch (error) {
    console.error(`Error reading job data for ${jobId}:`, error);
  }
  
  // Fallback to in-memory jobStore
  return jobStore[jobId];
}

// GET /api/jobs/[jobId]/events - Server-Sent Events for job status updates
export async function GET(
  request: NextRequest,
  context: { params: { jobId: string } }
) {
  // Get jobId from request params
  const { jobId } = await context.params;
  
  // SSE headers
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
  
  const encoder = new TextEncoder();
  
  // Create a stream
  const stream = new ReadableStream({
    start: async (controller) => {
      // Send initial message
      const job = getLatestJobData(jobId);
      
      if (!job) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`));
        controller.close();
        return;
      }
      
      // Initial status
      const initialStatus = {
        job_id: jobId,
        status: job.status === 'completed' ? 'completed' : (job.status === 'failed' ? 'failed' : 'processing'),
        message: job.message || 'Processing...',
        error: job.error,
        expiresAt: job.expiresAt
      };
      
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialStatus)}\n\n`));
      
      // If job already completed or failed, close the stream
      if (job.status === 'completed' || job.status === 'failed') {
        controller.close();
        return;
      }
      
      // Otherwise, poll for updates
      const interval = setInterval(async () => {
        const updatedJob = getLatestJobData(jobId);
        
        if (!updatedJob) {
          clearInterval(interval);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Job data lost' })}\n\n`));
          controller.close();
          return;
        }
        
        // Send current status
        const statusUpdate = {
          job_id: jobId,
          status: updatedJob.status === 'completed' ? 'completed' : (updatedJob.status === 'failed' ? 'failed' : 'processing'),
          message: updatedJob.message || 'Processing...',
          error: updatedJob.error,
          expiresAt: updatedJob.expiresAt
        };
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusUpdate)}\n\n`));
        
        // Close stream if job completed or failed
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          clearInterval(interval);
          controller.close();
        }
      }, 1000); // Poll every second
      
      // Cleanup on stream cancel
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    }
  });
  
  return new Response(stream, { headers });
} 