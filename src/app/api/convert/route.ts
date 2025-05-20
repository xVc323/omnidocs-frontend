import { NextRequest, NextResponse } from 'next/server';
// Remove spawn and path, as we are no longer calling python scripts directly from here.
// import { spawn } from 'child_process';
// import path from 'path';

type OutputFormat = "zip" | "single_md";

// Define the expected structure of the request body from the frontend
interface FrontendConversionPayload {
  url: string;
  outputFormat?: OutputFormat;
  pathsToInclude?: string[];
  pathsToExclude?: string[];
}

// For testing purposes, use a mock implementation
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FrontendConversionPayload;
    const { url, outputFormat = "zip" } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // For testing purposes, we'll use a fixed job ID and status URL
    
    console.log(`Mock conversion request for URL: ${url}, Format: ${outputFormat}`);

    // Return mock response with static URLs for testing
    return NextResponse.json({
      jobId: "test-job-123",
      statusUrl: `/api/mock-status`,
      message: 'Conversion job has been queued (MOCK)',
    }, { status: 202 });

  } catch (error) {
    console.error('Error in Next.js /api/convert route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to start conversion job: ${errorMessage}` }, { status: 500 });
  }
} 