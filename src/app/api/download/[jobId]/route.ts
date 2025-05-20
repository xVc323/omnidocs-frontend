import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '../../jobs/route';

// GET /api/download/[jobId] - Download job output file
export async function GET(
  request: NextRequest,
  context: { params: { jobId: string } }
) {
  // Get jobId using proper destructuring pattern with await
  const { jobId } = await context.params;
  
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'zip';
  
  // Validate job exists and is completed
  const job = jobStore[jobId];
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }
  
  if (job.status !== 'completed') {
    return NextResponse.json(
      { error: 'Job is not completed yet' },
      { status: 400 }
    );
  }
  
  // If job has an apiTaskId, it means it was processed by the Python backend 
  // and we can fetch the real file from there
  if (job.apiTaskId) {
    try {
      console.log(`Fetching file from Python API for job ${jobId} (API task ID: ${job.apiTaskId})...`);
      
      // Debug the API URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://omnidocs-backend-production.up.railway.app';
      console.log(`Using API URL: ${apiUrl}`);
      
      // Fetch the file from the Python API
      const apiResponse = await fetch(`${apiUrl}/api/download/${job.apiTaskId}`);
      
      if (!apiResponse.ok) {
        console.error(`Python API download failed: ${apiResponse.status} ${apiResponse.statusText}`);
        
        // Try to get more detailed error information if available
        try {
          const errorData = await apiResponse.json();
          console.error('Error details:', errorData);
          return NextResponse.json(
            { 
              error: 'Failed to download file from backend', 
              details: errorData.detail || errorData.error || JSON.stringify(errorData)
            },
            { status: 500 }
          );
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
          return NextResponse.json(
            { 
              error: 'Failed to download file from backend', 
              status: apiResponse.status,
              statusText: apiResponse.statusText
            },
            { status: 500 }
          );
        }
      }
      
      // Get content type from the Python API response
      const contentType = apiResponse.headers.get('Content-Type') || 
                          (format === 'single_md' ? 'text/markdown' : 'application/zip');
      
      // Get the filename from the Content-Disposition header if available
      let filename = '';
      const contentDisposition = apiResponse.headers.get('Content-Disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      
      // Fall back to a default filename if none was provided
      if (!filename) {
        const domain = new URL(job.url).hostname;
        filename = format === 'single_md' ? `${domain}-docs.md` : `${domain}-docs.zip`;
      }
      
      // Stream the file directly from the Python API
      const fileContent = await apiResponse.arrayBuffer();
      
      return new Response(fileContent, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error(`Error retrieving file from Python API:`, error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error(`Error name: ${error.name}, message: ${error.message}`);
        console.error(`Error stack: ${error.stack}`);
      } else {
        errorMessage = String(error);
      }
      return NextResponse.json(
        { 
          error: 'Failed to download file from backend',
          details: errorMessage
        },
        { status: 500 }
      );
    }
  }
  
  // If job doesn't have an apiTaskId, we fall back to generating simulated content
  // This path should only be used for backwards compatibility or testing
  console.log(`No API task ID for job ${jobId}, generating simulated content...`);
  
  // Extract domain/parts from the URL
  const url = new URL(job.url);
  const domain = url.hostname;
  const pathParts = url.pathname.split('/').filter(Boolean);
  const section = pathParts.length > 0 ? pathParts[0] : 'docs';

  // Generate more realistic content based on URL
  let content = '';
  let contentType = '';
  let filename = '';
  
  if (format === 'single_md') {
    contentType = 'text/markdown';
    filename = `${domain}-docs.md`;
    content = `# ${domain.toUpperCase()} Documentation

## Table of Contents
- [Introduction](#introduction)
- [${section.charAt(0).toUpperCase() + section.slice(1)} Overview](#${section}-overview)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Error Handling](#error-handling)

## Introduction
Documentation export from ${job.url} generated by OmniDocs Converter.
This file contains markdown content compiled from the documentation site.

## ${section.charAt(0).toUpperCase() + section.slice(1)} Overview
The ${domain} ${section} provides a comprehensive set of tools and resources for developers 
to integrate with our platform. Below you'll find a complete guide to all available features.

## Authentication
Most API requests to ${domain} require authentication. We support several methods:

\`\`\`
# API Key authentication example
curl -X GET "https://${domain}/api/v1/example" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

OAuth 2.0 is also supported for secure application access.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/v1/users | GET | List all users with pagination |
| /api/v1/users | POST | Create a new user account |
| /api/v1/users/:id | GET | Get detailed user information |
| /api/v1/users/:id | PUT | Update user data |
| /api/v1/products | GET | List all products |
| /api/v1/${section} | GET | Get information about ${section} |

### Detailed Endpoint: GET /api/v1/${section}

\`\`\`javascript
// Response example
{
  "status": "success",
  "data": {
    "id": "123456",
    "name": "Example ${section}",
    "created_at": "2023-09-15T12:00:00Z",
    "properties": {
      "type": "standard",
      "region": "us-west"
    }
  }
}
\`\`\`

## Examples

Here's a complete example of how to use the ${domain} API with JavaScript:

\`\`\`javascript
// Initialize the client
const client = new ${domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)}Client({
  apiKey: process.env.API_KEY
});

// Make a request
async function getResources() {
  try {
    const response = await client.${section}.list({
      limit: 10,
      offset: 0
    });
    
    console.log(\`Found \${response.data.length} resources\`);
    return response.data;
  } catch (error) {
    console.error('Error fetching resources:', error);
  }
}
\`\`\`

## Error Handling

All API errors follow a consistent format:

\`\`\`json
{
  "error": {
    "code": "resource_not_found",
    "message": "The requested resource could not be found",
    "doc_url": "https://${domain}/docs/errors#resource_not_found"
  }
}
\`\`\`

| Error Code | Description |
|------------|-------------|
| authentication_failed | Invalid API key or token |
| resource_not_found | The requested resource doesn't exist |
| rate_limit_exceeded | You've exceeded your rate limit |
| invalid_parameters | The request contains invalid parameters |
`;
  } else {
    // For ZIP, we'd normally create an actual ZIP file with multiple markdown files
    // For demo purposes, just describe what would be included
    contentType = 'text/plain';  // For demonstration, not sending binary
    filename = `${domain}-docs.txt`;
    content = `
This would be a ZIP archive containing the following files:

1. index.md - Main documentation page
2. ${section}/overview.md - Overview of ${section}
3. ${section}/authentication.md - Authentication methods 
4. ${section}/api-reference.md - API reference documentation
5. ${section}/examples/javascript.md - JavaScript examples
6. ${section}/examples/python.md - Python examples
7. ${section}/errors.md - Error code reference
8. images/ - Directory containing documentation images
9. order.txt - File defining the navigation structure

In a production environment, this would be an actual ZIP file with complete
markdown content extracted from ${job.url}.
`;
  }
  
  // Return the file with appropriate headers
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
} 