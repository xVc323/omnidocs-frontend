import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Helper function to validate URL
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

// Job interface definition 
interface Job {
  id: string;
  url: string;
  outputFormat: string;
  manualPathPrefix?: string;
  excludeRegex?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  r2Key?: string;
  apiTaskId?: string; // Added to store the actual Python API task ID
  expiresAt?: string; // Added to store the expiration time
}

// File-based job store for persistence between API calls
const jobStorePath = path.join(process.cwd(), 'job-store.json');

// Load all jobs from file or initialize empty store
function loadJobs(): Record<string, Job> {
  try {
    if (fs.existsSync(jobStorePath)) {
      const data = fs.readFileSync(jobStorePath, 'utf8');
      // Parse dates correctly from JSON
      const parsed = JSON.parse(data, (key, value) => {
        if (key === 'createdAt' || key === 'updatedAt') {
          return new Date(value);
        }
        return value;
      });
      return parsed;
    }
  } catch (error) {
    console.error('Error loading jobs:', error);
  }
  
  // Default empty store
  return {};
}

// Save all jobs to file
function saveJobs(jobs: Record<string, Job>) {
  try {
    fs.writeFileSync(jobStorePath, JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error('Error saving jobs:', error);
  }
}

// Export jobStore for other API routes
export const jobStore: Record<string, Job> = loadJobs();

// POST /api/jobs - Create a new conversion job
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, outputFormat, manualPathPrefix, excludeRegex } = body;
    
    // Validate required fields
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Validate URL format
    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    // Create a new job
    const jobId = uuidv4();
    const job: Job = {
      id: jobId,
      url,
      outputFormat: outputFormat || 'zip',
      manualPathPrefix,
      excludeRegex,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store job
    jobStore[jobId] = job;
    saveJobs(jobStore);
    
    // Process job in background
    processJob(jobId);
    
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

// GET /api/jobs - List all jobs (for admin/debug)
export async function GET() {
  return NextResponse.json(Object.values(jobStore));
}

// Process job by calling the Python API
async function processJob(jobId: string) {
  const job = jobStore[jobId];
  if (!job) return;
  
  try {
    // Update job status
    console.log(`Job ${jobId}: Starting conversion process...`);
    job.status = 'processing';
    job.message = 'Starting conversion process...';
    job.updatedAt = new Date();
    saveJobs(jobStore);
    
    // Prepare API request - modify this to match your python API structure
    const payload = {
      site_url: job.url,
      output_format: job.outputFormat,
      path_prefix: job.manualPathPrefix || null,
      use_regex: !!job.excludeRegex, // Convert to boolean
      custom_regex: job.excludeRegex || null
    };
    
    // Debug the API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://omnidocs-backend-production.up.railway.app';
    console.log(`Using API URL: ${apiUrl}`);
    
    // Connect to the Python backend
    console.log(`Connecting to Python API with payload:`, payload);
    const apiResponse = await fetch(`${apiUrl}/api/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`API error: ${apiResponse.status} - ${errorText}`);
    }
    
    // Get the Python task ID
    const apiData = await apiResponse.json();
    job.apiTaskId = apiData.job_id;
    job.message = 'Crawling documentation pages...';
    job.updatedAt = new Date();
    saveJobs(jobStore);
    console.log(`Job ${jobId} assigned API task ID: ${job.apiTaskId}`);
    
    // Poll for task status
    let isComplete = false;
    let isFailed = false;
    while (!isComplete && !isFailed) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
      
      // Get status from Python API
      const statusResponse = await fetch(`${apiUrl}/api/job/${job.apiTaskId}/status`);
      if (!statusResponse.ok) {
        console.error(`Failed to get task status: ${statusResponse.status}`);
        continue;
      }
      
      const statusData = await statusResponse.json();
      console.log(`Task ${job.apiTaskId} status:`, statusData.state);
      
      if (statusData.state === 'PROGRESS' && statusData.info && statusData.info.status) {
        job.message = statusData.info.status;
        
        // Add the current URL to the message if available
        if (statusData.info.current_url && job.message) {
          // Format to display something like: "Crawling: https://example.com/docs (3/10)" 
          if (job.message.includes("(") && job.message.includes("/")) {
            // Keep the progress count but add the URL
            job.message = `${job.message} - ${statusData.info.current_url}`;
          } else {
            job.message = `${job.message} - ${statusData.info.current_url}`;
          }
        }
        
        job.updatedAt = new Date();
        saveJobs(jobStore);
      }
      
      if (statusData.state === 'SUCCESS') {
        isComplete = true;
        job.status = 'completed';
        job.message = 'Conversion completed';
        
        // Use the resulting file path or R2 key
        if (statusData.result) {
          if (statusData.result.r2_object_key || statusData.result.r2ObjectKey) {
            job.r2Key = statusData.result.r2_object_key || statusData.result.r2ObjectKey;
          }
          
          // Set expiration time if available
          if (statusData.result.expiresAt) {
            job.expiresAt = statusData.result.expiresAt;
          }
        }
        
        job.updatedAt = new Date();
        saveJobs(jobStore);
        console.log(`Job ${jobId}: All done! R2 Key: ${job.r2Key}`);
      } else if (statusData.state === 'FAILURE') {
        isFailed = true;
        job.status = 'failed';
        job.error = statusData.error || 'Task failed';
        job.updatedAt = new Date();
        saveJobs(jobStore);
        console.error(`Job ${jobId} failed: ${job.error}`);
      }
    }
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'An unexpected error occurred';
    job.updatedAt = new Date();
    saveJobs(jobStore);
  }
} 